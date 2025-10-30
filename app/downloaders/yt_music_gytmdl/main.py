#!/usr/bin/env python3
"""YouTube Music Downloader with gytmdl - Music-focused with synced lyrics."""

import json
from pathlib import Path
from typing import Optional

import yaml
from pydantic import BaseModel, Field
from rich.console import Console
from rich.panel import Panel
from rich.prompt import Prompt
from rich.table import Table
from rich import box

from gytmdl.downloader import Downloader
from gytmdl.enums import CoverFormat, DownloadMode


# ---------- Config Model ----------

class MusicDLConfig(BaseModel):
    download_dir: Path = Field(default=Path("./downloads"))
    audio_itag: str = Field(default="140", description="Audio quality itag")
    folder_template: str = Field(default="{title} - {artist}")
    file_template: str = Field(default="audio")
    cover_size: int = Field(default=1200)
    cover_format: str = Field(default="jpg")
    save_cover_separate: bool = Field(default=True)
    download_lyrics: bool = Field(default=True)
    create_metadata_json: bool = Field(default=True)
    cookies_file: Optional[Path] = None


# ---------- Helpers ----------

console = Console()
CONFIG_PATH = Path(__file__).parent / "config.yaml"


def load_config(path: Path) -> MusicDLConfig:
    """Load configuration from YAML file."""
    if path.exists():
        with path.open("r", encoding="utf-8") as f:
            raw = yaml.safe_load(f) or {}
    else:
        raw = {}
    return MusicDLConfig(**raw)


def save_metadata_json(tags: dict, output_dir: Path):
    """Save metadata as JSON file."""
    metadata = {
        "title": tags.get("title"),
        "artist": tags.get("artist"),
        "album": tags.get("album"),
        "album_artist": tags.get("album_artist"),
        "track_number": tags.get("track"),
        "total_tracks": tags.get("track_total"),
        "disc_number": tags.get("disc"),
        "total_discs": tags.get("disc_total"),
        "date": tags.get("date"),
        "year": tags.get("year"),
        "genre": tags.get("genre"),
        "lyrics": tags.get("lyrics"),
    }

    # Remove None values
    metadata = {k: v for k, v in metadata.items() if v is not None}

    metadata_path = output_dir / "metadata.json"
    metadata_path.parent.mkdir(parents=True, exist_ok=True)
    with open(metadata_path, "w", encoding="utf-8") as f:
        json.dump(metadata, f, indent=2, ensure_ascii=False)


# ---------- Main Flow ----------

def main():
    console.print(
        Panel.fit(
            "[bold white]YouTube Music Downloader[/] · gytmdl-powered · Synced Lyrics",
            title="[bold magenta]ytmusic-gytmdl[/]",
            border_style="magenta",
        )
    )

    cfg = load_config(CONFIG_PATH)

    # Show config
    table = Table(title="Configuration", box=box.MINIMAL_DOUBLE_HEAD)
    table.add_column("Setting", style="bold cyan")
    table.add_column("Value", style="white")
    table.add_row("Download Dir", str(cfg.download_dir.resolve()))
    table.add_row("Audio Quality", cfg.audio_itag)
    table.add_row("Download Lyrics", "✓" if cfg.download_lyrics else "✗")
    table.add_row("Create Metadata", "✓" if cfg.create_metadata_json else "✗")
    console.print(table)

    # Ensure download directory exists
    cfg.download_dir.mkdir(parents=True, exist_ok=True)

    # Get URL
    url = Prompt.ask("[bold green]Paste YouTube Music URL[/]")
    if not url.strip():
        console.print("[red]No URL provided. Exiting.[/]")
        return

    # Map cover format
    cover_format_map = {
        "jpg": CoverFormat.JPG,
        "png": CoverFormat.PNG,
        "raw": CoverFormat.RAW,
    }

    # Initialize gytmdl Downloader
    console.print("\n[cyan]Initializing downloader...[/]")
    downloader = Downloader(
        output_path=cfg.download_dir,
        temp_path=Path("./temp"),
        cookies_path=cfg.cookies_file,
        itag=cfg.audio_itag,
        download_mode=DownloadMode.YTDLP,
        cover_size=cfg.cover_size,
        cover_format=cover_format_map.get(cfg.cover_format, CoverFormat.JPG),
        template_folder=cfg.folder_template,
        template_file=cfg.file_template,
        silent=False,
    )

    # Get download queue
    console.print("[cyan]Fetching track info...[/]")
    try:
        download_queue = list(downloader.get_download_queue(url))
    except Exception as e:
        console.print(f"[red]Failed to fetch track info:[/] {e}")
        return

    if not download_queue:
        console.print("[yellow]No tracks found.[/]")
        return

    console.print(f"[green]Found {len(download_queue)} track(s)[/]\n")

    # Process each track
    for idx, queue_item in enumerate(download_queue, 1):
        title = queue_item["title"]
        video_id = queue_item["id"]

        console.print(f"[bold]Track {idx}/{len(download_queue)}:[/] {title}")

        try:
            # Get metadata from YouTube Music API
            console.print("  → Fetching metadata...")
            ytmusic_playlist = downloader.get_ytmusic_watch_playlist(video_id)

            if not ytmusic_playlist:
                console.print("  [yellow]⚠ No album info available, skipping[/]")
                continue

            tags = downloader.get_tags(ytmusic_playlist)
            final_path = downloader.get_final_path(tags)

            # Check if already exists
            if final_path.exists():
                console.print(f"  [yellow]⚠ Already exists, skipping[/]")
                continue

            # Download audio
            console.print("  → Downloading audio...")
            video_id_actual = ytmusic_playlist["tracks"][0]["videoId"]
            track_temp_path = downloader.get_track_temp_path(video_id_actual)
            remuxed_path = downloader.get_remuxed_path(video_id_actual)

            try:
                downloader.download(video_id_actual, track_temp_path)
            except Exception as e:
                if "Requested format is not available" in str(e):
                    # Fallback: try with different itag
                    console.print("  [yellow]⚠ Format not available, trying alternative...[/]")
                    original_itag = downloader.itag
                    # Try 141 first, then 140, then 139
                    fallback_itags = ['141', '140', '139']
                    if original_itag in fallback_itags:
                        fallback_itags.remove(original_itag)

                    success = False
                    for itag in fallback_itags:
                        try:
                            downloader.itag = itag
                            downloader._set_ytdlp_options()
                            console.print(f"  [dim]  Trying itag {itag}...[/]")
                            downloader.download(video_id_actual, track_temp_path)
                            success = True
                            break
                        except Exception:
                            continue

                    if not success:
                        raise Exception("No compatible audio format found")
                    downloader.itag = original_itag  # Restore for next track
                else:
                    raise

            # Remux
            console.print("  → Processing audio...")
            downloader.remux(track_temp_path, remuxed_path)

            # Apply tags
            console.print("  → Embedding metadata...")
            cover_url = downloader.get_cover_url(ytmusic_playlist)
            downloader.apply_tags(remuxed_path, tags, cover_url)

            # Move to final location
            downloader.move_to_output_path(remuxed_path, final_path)

            # Download synced lyrics
            if cfg.download_lyrics and tags.get("lyrics"):
                console.print("  → Downloading synced lyrics...")
                synced_lyrics_path = downloader.get_synced_lyrics_path(final_path)
                synced_lyrics = downloader.get_synced_lyrics(ytmusic_playlist)
                if synced_lyrics:
                    downloader.save_synced_lyrics(synced_lyrics_path, synced_lyrics)
                    console.print("  [green]✓ Lyrics saved[/]")
                else:
                    console.print("  [dim]  (No synced lyrics available)[/]")

            # Save separate cover
            if cfg.save_cover_separate:
                console.print("  → Saving cover art...")
                cover_file_ext = downloader.get_cover_file_extension(cover_url)
                cover_path = downloader.get_cover_path(final_path, cover_file_ext)
                downloader.save_cover(cover_path, cover_url)

            # Save metadata JSON
            if cfg.create_metadata_json:
                console.print("  → Saving metadata.json...")
                save_metadata_json(tags, final_path.parent)

            # Show result
            console.print(f"\n[bold green]✓ Success![/] Saved to: {final_path.parent}\n")

            # List files
            if final_path.parent.exists():
                files = sorted(final_path.parent.iterdir())
                console.print("[dim]Files:[/]")
                for f in files:
                    console.print(f"  • {f.name}")

            console.print()

        except Exception as e:
            console.print(f"  [red]✗ Error: {e}[/]\n")
            continue

    console.print("[bold green]Done![/]")


if __name__ == "__main__":
    main()
