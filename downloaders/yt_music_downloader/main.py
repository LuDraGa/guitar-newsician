import os
from pathlib import Path
from typing import Optional, Literal, Dict, Any

from pydantic import BaseModel, Field, field_validator, field_serializer
import yaml
from rich.console import Console
from rich.panel import Panel
from rich.prompt import Prompt, Confirm
from rich.table import Table
from rich import box
from rich.progress import (
    Progress,
    BarColumn,
    TextColumn,
    TimeElapsedColumn,
    TimeRemainingColumn,
    DownloadColumn,
    TransferSpeedColumn,
)
from rich import box
from urllib.parse import parse_qs, urlparse

# third-party downloader
try:
    from yt_dlp import YoutubeDL
except ImportError as e:
    raise SystemExit("Missing dependency 'yt-dlp'. Install with: uv add yt-dlp") from e

# ---------- Config Model ----------

AudioFmt = Literal["mp3", "m4a", "opus", "flac", "wav", "aac"]
Browser = Literal["chrome", "chromium", "edge", "firefox", "safari"]
PlayerClient = Literal["web", "android", "tv"]


class DLConfig(BaseModel):
    download_dir: Path = Field(default=Path("./downloads"))
    filename_template: str = Field(
        default="%(title)s [%(id)s].%(ext)s",
        description="yt-dlp outtmpl (no directory).",
    )
    audio_format: AudioFmt = "m4a"
    # preferredquality meaning depends on codec. For mp3 it's kbps (e.g. 320).
    audio_quality: str = Field(default="320")
    rate_limit: Optional[str] = Field(
        default=None, description="Limit download rate, e.g. '2M' or '900K'."
    )
    proxy: Optional[str] = None
    embed_metadata: bool = True
    prefer_free_formats: bool = False
    noplaylist: bool = True

    use_cookies_from_browser: Optional[Browser] = None  # e.g. "chrome"
    cookiefile: Optional[str] = None  # alternative to browser cookies
    yt_player_client: PlayerClient = "web"  # fallback: "android" often fixes 403
    user_agent: Optional[str] = None  # custom UA header (optional)
    ytdlp_extra: Dict[str, Any] = Field(default_factory=dict)

    @field_serializer("download_dir")
    def _ser_download_dir(self, v: Path) -> str:
        return str(v)

    @field_validator("download_dir", mode="before")
    def _to_path(cls, v):
        return Path(v)

    @field_validator("audio_quality")
    def _validate_quality(cls, v):
        # Allow numbers or strings like 320, "192", "0"
        s = str(v).strip()
        if not s.isdigit():
            raise ValueError(
                "audio_quality must be an integer string (e.g., '320', '192', '0')."
            )
        return s

    def summarize(self) -> Table:
        t = Table(title="Current Configuration", box=box.MINIMAL_DOUBLE_HEAD)
        t.add_column("Key", style="bold cyan", no_wrap=True)
        t.add_column("Value", style="white")
        rows = [
            ("download_dir", str(self.download_dir.resolve())),
            ("filename_template", self.filename_template),
            ("audio_format", self.audio_format),
            ("audio_quality", self.audio_quality),
            ("rate_limit", self.rate_limit or "None"),
            ("proxy", self.proxy or "None"),
            ("embed_metadata", str(self.embed_metadata)),
            ("prefer_free_formats", str(self.prefer_free_formats)),
            ("ytdlp_extra", str(self.ytdlp_extra) if self.ytdlp_extra else "None"),
        ]
        for k, v in rows:
            t.add_row(k, v)
        return t


# ---------- Helpers ----------

console = Console()
CONFIG_PATH = Path(__file__).parent / "config.yaml"


def load_config(path: Path) -> DLConfig:
    if path.exists():
        with path.open("r", encoding="utf-8") as f:
            raw = yaml.safe_load(f) or {}
    else:
        raw = {}
    return DLConfig(**raw)


def save_config(path: Path, cfg: DLConfig) -> None:
    path.parent.mkdir(parents=True, exist_ok=True)
    with path.open("w", encoding="utf-8") as f:
        yaml.safe_dump(cfg.model_dump(), f, sort_keys=False, allow_unicode=True)


def pick_directory(start: Path | None = None) -> Path | None:
    """
    Simple Rich-powered directory picker.
    Controls:
      - number: enter that subdirectory
      - . : choose current directory
      - .. : go up
      - / or ~-prefixed path: jump to path
      - q : cancel
    """
    cur = Path(start or Path.cwd()).resolve()

    while True:
        subdirs = [p for p in cur.iterdir() if p.is_dir()]
        subdirs.sort(key=lambda p: p.name.lower())

        table = Table(
            title=f"[bold]Choose a directory[/]  ([cyan]{cur}[/])",
            box=box.MINIMAL_DOUBLE_HEAD,
            expand=True,
        )
        table.add_column("#", justify="right", style="bold cyan", no_wrap=True)
        table.add_column("Folder", style="white")

        if not subdirs:
            table.add_row("-", "[dim]No subfolders[/]")

        for idx, p in enumerate(subdirs, start=1):
            table.add_row(str(idx), p.name)

        console.clear()
        console.print(
            Panel.fit(
                "Controls: '.' = select current • '..' = up • 'q' = cancel • "
                "type /absolute or ~/relative to jump",
                border_style="magenta",
                title="Directory Picker",
            )
        )

        console.print(table)

        choice = Prompt.ask("[bold green]Enter choice[/]").strip()

        if choice.lower() == "q":
            return None
        if choice == ".":
            return cur
        if choice == "..":
            parent = cur.parent
            cur = parent if parent != cur else cur
            continue
        # jump to typed path
        if choice.startswith("/") or choice.startswith("~"):
            target = Path(choice).expanduser().resolve()
            if target.exists() and target.is_dir():
                cur = target
            else:
                console.print(f"[red]Not a directory:[/] {choice}")
            continue
        # numeric enter
        if choice.isdigit():
            i = int(choice)
            if 1 <= i <= len(subdirs):
                cur = subdirs[i - 1].resolve()
            else:
                console.print("[red]Invalid index[/]")
            continue

        console.print("[yellow]Unrecognized input[/]")


def build_ytdlp_opts(cfg: DLConfig, progress_cb):
    postprocessors = [
        {
            "key": "FFmpegExtractAudio",
            "preferredcodec": cfg.audio_format,
            "preferredquality": cfg.audio_quality,
        }
    ]
    if cfg.embed_metadata:
        postprocessors.append({"key": "FFmpegMetadata"})
    fmt = "bestaudio/best"
    outtmpl = str(cfg.download_dir / cfg.filename_template)

    headers = {}
    if cfg.user_agent:
        headers["User-Agent"] = cfg.user_agent
    # Lightly helpful default; safe to include
    headers.setdefault("Accept-Language", "en-US,en;q=0.8")

    opts: Dict[str, Any] = {
        "format": "bestaudio/best",
        "outtmpl": outtmpl,
        "noprogress": True,
        "progress_hooks": [progress_cb],
        "prefer_free_formats": cfg.prefer_free_formats,
        "postprocessors": postprocessors,
        "quiet": True,
        "nocheckcertificate": True,
        "noplaylist": cfg.noplaylist,
        "geo_bypass": True,
        "http_headers": headers,
    }
    if cfg.rate_limit:
        opts["ratelimit"] = cfg.rate_limit
    if cfg.proxy:
        opts["proxy"] = cfg.proxy
    if cfg.user_agent:
        opts.setdefault("http_headers", {})["User-Agent"] = cfg.user_agent
    if cfg.cookiefile:
        opts["cookiefile"] = cfg.cookiefile
    if cfg.use_cookies_from_browser:
        # yt-dlp supports tuple form
        opts["cookiesfrombrowser"] = (cfg.use_cookies_from_browser,)
    # Let config pick YouTube player client (sometimes avoids 403)
    if cfg.yt_player_client in {"android", "tv"}:
        opts["extractor_args"] = {"youtube": {"player_client": [cfg.yt_player_client]}}
    if cfg.ytdlp_extra:
        opts.update(cfg.ytdlp_extra)
    return opts


# ---------- Main Flow (Rich TUI) ----------


def main():
    console.print(
        Panel.fit(
            "[bold white]YT Music Downloader[/] · YAML-driven · Rich TUI",
            title="[bold magenta]ytmusic-dl[/]",
            border_style="magenta",
        )
    )

    default_cfg_path = CONFIG_PATH
    cfg = load_config(default_cfg_path)

    console.print(cfg.summarize())

    # Ensure download directory exists
    cfg.download_dir.mkdir(parents=True, exist_ok=True)

    url = Prompt.ask("[bold green]Paste YouTube / YouTube Music URL[/]")
    if not url.strip():
        console.print("[red]No URL provided. Exiting.[/]")
        return

    if Confirm.ask("Override any settings now?", default=False):
        # Simple guided overrides
        use_picker = Confirm.ask(
            "Open directory picker for download_dir?", default=True
        )
        if use_picker:
            picked = pick_directory(cfg.download_dir)
            if picked is None:
                console.print("[yellow]Cancelled picker. Keeping current directory.[/]")
                dd = str(cfg.download_dir)
            else:
                dd = str(picked)
        else:
            dd = Prompt.ask("Download directory", default=str(cfg.download_dir))

        ft = Prompt.ask("Filename template", default=cfg.filename_template)
        af = Prompt.ask(
            "Audio format (mp3/m4a/opus/flac/wav/aac)", default=cfg.audio_format
        )
        aq = Prompt.ask("Audio quality (e.g., 320, 192, 0)", default=cfg.audio_quality)
        rl = Prompt.ask("Rate limit (e.g., 2M) or blank", default=cfg.rate_limit or "")
        px = Prompt.ask(
            "Proxy (e.g., http://127.0.0.1:7890) or blank", default=cfg.proxy or ""
        )
        em = Confirm.ask("Embed metadata?", default=cfg.embed_metadata)
        pf = Confirm.ask("Prefer free formats?", default=cfg.prefer_free_formats)

        # Validate into model
        cfg = DLConfig(
            download_dir=dd,
            filename_template=ft,
            audio_format=af,
            audio_quality=aq,
            rate_limit=rl,
            proxy=px,
            embed_metadata=em,
            prefer_free_formats=pf,
            ytdlp_extra=cfg.ytdlp_extra,
        )

        console.print(Panel.fit("Updated settings:", border_style="cyan"))
        console.print(cfg.summarize())

        if Confirm.ask(f"Save these back to {default_cfg_path}?", default=True):
            save_config(default_cfg_path, cfg)
            console.print(f"[green]Saved config to[/] {default_cfg_path}")

    # Progress UI
    progress = Progress(
        TextColumn("[bold blue]{task.fields[stage]}[/]"),
        BarColumn(),
        DownloadColumn(),
        TransferSpeedColumn(),
        TimeElapsedColumn(),
        TimeRemainingColumn(),
        expand=True,
    )

    task_id = progress.add_task("download", stage="Preparing", total=0)

    state = {"total": 0}

    def hook(d):
        # yt-dlp progress hook
        if d["status"] == "downloading":
            # d.get('_total_bytes') or '_total_bytes_estimate'
            total = d.get("_total_bytes") or d.get("_total_bytes_estimate") or 0
            downloaded = d.get("downloaded_bytes", 0)
            if state["total"] != total:
                state["total"] = total
                progress.update(task_id, total=float(total) if total else None)
            progress.update(task_id, completed=float(downloaded), stage="Downloading")
        elif d["status"] == "finished":
            progress.update(task_id, stage="Converting (ffmpeg)…")
        elif d["status"] == "error":
            progress.update(task_id, stage="Error")

    def try_download(ytdlp_opts, url):
        with YoutubeDL(ytdlp_opts) as ytdl:
            return ytdl.extract_info(url, download=True)

    def looks_like_playlist(u: str) -> bool:
        q = parse_qs(urlparse(u).query)
        return "list" in q

    # After normalizing URL:
    if looks_like_playlist(url) and cfg.noplaylist:
        if Confirm.ask("Playlist detected. Download entire playlist?", default=False):
            cfg.noplaylist = False

    ytdlp_opts = build_ytdlp_opts(cfg, hook)
    print(ytdlp_opts)

    with progress:
        progress.update(task_id, stage="Starting", total=None)
        info = None
        try:
            info = try_download(ytdlp_opts, url)
            # with YoutubeDL(ytdlp_opts) as ytdl:
            #     info = ytdl.extract_info(url, download=True)
        except Exception as e:
            msg = str(e)
            if "HTTP Error 403" in msg or "Forbidden" in msg:
                console.print(
                    Panel.fit(
                        "[red]403 Forbidden[/]\n"
                        "Switching to browser cookies + Android client and retrying once…",
                        border_style="red",
                        title="Access blocked",
                    )
                )
                # Default to Chrome cookies; change if you use another browser
                cfg.use_cookies_from_browser = cfg.use_cookies_from_browser or "chrome"
                cfg.yt_player_client = "android"
                # Optional: set a mainstream UA if you like
                cfg.user_agent = cfg.user_agent or (
                    "Mozilla/5.0 (Windows NT 10.0; Win64; x64) "
                    "AppleWebKit/537.36 (KHTML, like Gecko) "
                    "Chrome/120.0.0.0 Safari/537.36"
                )
                ytdlp_opts = build_ytdlp_opts(cfg, hook)
                try:
                    info = try_download(ytdlp_opts, url)
                except Exception as e2:
                    progress.update(task_id, stage="Failed")
                    console.print(f"[red]Retry failed:[/] {e2}")
                    return
            else:
                progress.update(task_id, stage="Failed")
                console.print(f"[red]Download failed:[/] {e}")
                return
        try:
            progress.update(
                task_id, stage="Done", total=state["total"], completed=state["total"]
            )
        except Exception as e:
            progress.update(task_id, stage="Failed")
            console.print(f"[red]Download failed:[/] {e}")
            return

    # Show result summary
    title = info.get("title", "Unknown Title")
    out_file = ytdlp_opts["outtmpl"]
    console.print(
        Panel.fit(
            f"[bold green]Success![/]\nTitle: [white]{title}[/]\nSaved to: [white]{out_file}[/]",
            border_style="green",
            title="Result",
        )
    )


if __name__ == "__main__":
    # Friendly legal note
    console.print(
        Panel.fit(
            "[yellow]Download only content you own rights to or that is licensed for your use. "
            "Respect YouTube/YouTube Music terms and local laws.[/]",
            border_style="yellow",
            title="Heads-up",
        )
    )
    main()
