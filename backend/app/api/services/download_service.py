"""Download service implementation."""

import asyncio
import json
import os
import re
import shutil
import subprocess
from pathlib import Path
from typing import Optional, Dict, Any
from dotenv import load_dotenv
from ..models.jobs import JobState
from ..services.job_manager import job_manager
from ..config import get_config
from ..utils.path_helpers import sanitize_filename

load_dotenv()


class DownloadService:
    """Service for downloading audio from YouTube Music."""

    def _build_ytdlp_opts(
        self,
        song_folder: Path,
        audio_format: str,
        quality: str,
        progress_callback,
        use_cookies: bool = False,
        player_clients: Optional[list[str]] = None,
    ) -> Dict[str, Any]:
        """Build yt-dlp options with 403 fix support."""
        # Map quality to bitrate (for mp3/aac)
        quality_map = {"high": "320", "medium": "192", "low": "128"}
        bitrate = quality_map.get(quality, "320")

        postprocessors = [
            {
                "key": "FFmpegExtractAudio",
                "preferredcodec": audio_format,
                "preferredquality": bitrate,
            },
            {"key": "FFmpegMetadata"},
        ]

        opts: Dict[str, Any] = {
            "format": self._format_selector(audio_format),
            "outtmpl": {"default": str(song_folder / f"audio.%(ext)s")},
            "noprogress": True,
            "progress_hooks": [progress_callback],
            "prefer_free_formats": False,
            "postprocessors": postprocessors,
            "quiet": True,
            "nocheckcertificate": True,
            "noplaylist": True,
            "geo_bypass": True,
            "check_formats": True,
            "retries": 3,
            "fragment_retries": 3,
            "extractor_retries": 3,
            "http_headers": {
                "Accept-Language": "en-US,en;q=0.8",
                "User-Agent": (
                    "Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) "
                    "AppleWebKit/537.36 (KHTML, like Gecko) "
                    "Chrome/125.0.0.0 Safari/537.36"
                ),
            },
        }

        js_runtime = self._node_runtime_path()
        if js_runtime:
            opts["js_runtimes"] = {"node": {"path": js_runtime}}
            # Allow yt-dlp to fetch the external challenge solver when needed.
            opts["remote_components"] = ["ejs:github"]

        # Add cookie support for 403 bypass
        cookiefile = os.getenv("YTDLP_COOKIEFILE")
        if use_cookies and cookiefile:
            opts["cookiefile"] = cookiefile
        elif use_cookies:
            browser = os.getenv("YTDLP_COOKIES_BROWSER", "chrome")
            opts["cookiesfrombrowser"] = (browser,)

        if player_clients:
            opts["extractor_args"] = {"youtube": {"player_client": player_clients}}

        return opts

    def _format_selector(self, audio_format: str) -> str:
        if audio_format == "m4a":
            return "bestaudio[ext=m4a]/bestaudio[acodec^=mp4a]/bestaudio/best"
        if audio_format == "opus":
            return "bestaudio[acodec=opus]/bestaudio[ext=webm]/bestaudio/best"
        return "bestaudio/best"

    def _node_runtime_path(self) -> Optional[str]:
        return self._node_runtime_info().get("path")

    def _node_runtime_info(self) -> Dict[str, Any]:
        candidates: list[tuple[str, Path]] = []
        configured = os.getenv("YTDLP_NODE_PATH")
        if configured:
            candidates.append(("YTDLP_NODE_PATH", Path(configured)))

        discovered = shutil.which("node")
        if discovered:
            candidates.append(("PATH", Path(discovered)))

        nvm_root = Path.home() / ".nvm" / "versions" / "node"
        if nvm_root.exists():
            nvm_candidates = sorted(
                nvm_root.glob("v*/bin/node"),
                key=self._node_candidate_version_key,
                reverse=True,
            )
            candidates.extend(("nvm", candidate) for candidate in nvm_candidates)

        seen: set[str] = set()
        fallback: Dict[str, Any] = {}
        inspected: list[Dict[str, Any]] = []

        for source, candidate in candidates:
            path = str(candidate)
            if path in seen:
                continue
            seen.add(path)

            version = self._node_version(path)
            supported = self._node_version_is_supported(version)
            info = {
                "path": path,
                "source": source,
                "version": version,
                "supported": supported,
            }
            inspected.append(info)

            if version and not fallback:
                fallback = info
            if supported:
                return {**info, "candidates": inspected}

        if fallback:
            return {**fallback, "candidates": inspected}
        return {"path": None, "source": None, "version": None, "supported": False, "candidates": inspected}

    def _node_candidate_version_key(self, path: Path) -> tuple[int, int, int]:
        match = re.search(r"/v(\d+)\.(\d+)\.(\d+)/", str(path))
        if not match:
            return (0, 0, 0)
        return tuple(int(part) for part in match.groups())

    def _node_version(self, path: str) -> Optional[str]:
        try:
            result = subprocess.run(
                [path, "--version"],
                capture_output=True,
                check=False,
                text=True,
                timeout=3,
            )
        except (OSError, subprocess.SubprocessError):
            return None

        version = result.stdout.strip() or result.stderr.strip()
        return version or None

    def _node_version_is_supported(self, version: Optional[str]) -> bool:
        if not version:
            return False
        match = re.match(r"v?(\d+)\.", version)
        if not match:
            return False
        return int(match.group(1)) >= 22

    def _download_attempts(self) -> list[dict[str, Any]]:
        cookiefile = os.getenv("YTDLP_COOKIEFILE")
        cookie_label = f"cookie file {cookiefile}" if cookiefile else f"{os.getenv('YTDLP_COOKIES_BROWSER', 'chrome')} browser cookies"

        return [
            {"label": "default clients", "player_clients": ["default"], "use_cookies": False},
            {"label": "tv/web clients", "player_clients": ["tv", "web"], "use_cookies": False},
            {"label": "iOS client", "player_clients": ["ios"], "use_cookies": False},
            {"label": "Android SDK-less client", "player_clients": ["android_sdkless"], "use_cookies": False},
            {"label": cookie_label, "player_clients": ["default"], "use_cookies": True},
            {"label": "web client with cookies", "player_clients": ["web"], "use_cookies": True},
        ]

    def diagnostics(self) -> Dict[str, Any]:
        """Return local yt-dlp prerequisites used by the download route."""
        node_runtime = self._node_runtime_info()
        return {
            "node_runtime": node_runtime["path"],
            "node_runtime_source": node_runtime["source"],
            "node_version": node_runtime["version"],
            "node_supported_for_ejs": node_runtime["supported"],
            "node_candidates": node_runtime["candidates"],
            "cookiefile": os.getenv("YTDLP_COOKIEFILE"),
            "cookies_browser": os.getenv("YTDLP_COOKIES_BROWSER", "chrome"),
            "remote_components": ["ejs:github"],
            "attempts": [attempt["label"] for attempt in self._download_attempts()],
        }

    def _create_metadata_file(self, info: Dict[str, Any], output_dir: Path) -> None:
        """Create a metadata.json file with track information."""
        metadata = {
            "video_id": info.get("id"),
            "title": info.get("title"),
            "artist": info.get("artist") or info.get("uploader") or info.get("channel"),
            "album": info.get("album"),
            "track": info.get("track"),
            "duration": info.get("duration"),
            "upload_date": info.get("upload_date"),
            "description": info.get("description"),
            "thumbnail": info.get("thumbnail"),
            "webpage_url": info.get("webpage_url"),
            "view_count": info.get("view_count"),
            "like_count": info.get("like_count"),
            "channel": info.get("channel"),
            "channel_id": info.get("channel_id"),
            "categories": info.get("categories"),
            "tags": info.get("tags"),
        }

        # Remove None values
        metadata = {k: v for k, v in metadata.items() if v is not None}

        metadata_path = output_dir / "metadata.json"
        with open(metadata_path, "w", encoding="utf-8") as f:
            json.dump(metadata, f, indent=2, ensure_ascii=False)

    def _fetch_lyrics(self, video_id: str, output_dir: Path, metadata: Dict[str, Any] = None) -> Dict[str, bool]:
        """Fetch and save lyrics using cascading strategy: YTMusic first, then syncedlyrics."""
        from ytmusicapi import YTMusic
        from app.downloaders.yt_music_downloader.helpers import fetch_lyrics
        import logging

        logger = logging.getLogger(__name__)
        lyrics_info = {"has_synced_lyrics": False, "has_plain_lyrics": False}

        synced_lyrics = None
        plain_lyrics = None

        # Strategy 1: Try YTMusic API first (gets lyrics from YouTube Music)
        if video_id:
            try:
                logger.info(f"Attempting YTMusic lyrics fetch for video_id: {video_id}")
                ytmusic = YTMusic()
                ytm_synced, ytm_plain = fetch_lyrics(video_id, ytmusic)

                if ytm_synced:
                    synced_lyrics = ytm_synced
                    logger.info(f"YTMusic: Found synced lyrics")

                if ytm_plain:
                    plain_lyrics = ytm_plain
                    logger.info(f"YTMusic: Found plain lyrics")

            except Exception as e:
                logger.warning(f"YTMusic lyrics fetch failed: {str(e)}")
        else:
            logger.warning("No video ID provided for lyrics fetching")

        # Strategy 2: If no synced lyrics from YTMusic, try syncedlyrics
        if not synced_lyrics and metadata:
            try:
                logger.info("Attempting syncedlyrics fetch as fallback")
                from app.lyrics.synced_lyrics import fetch_synced_lyrics, has_syncedlyrics

                if has_syncedlyrics():
                    title = metadata.get("title", "")
                    artist = metadata.get("artist", "")

                    if title:
                        result = fetch_synced_lyrics(
                            title=title,
                            artist=artist,
                            allow_unsynced=True  # Allow fallback to unsynced
                        )

                        if result.found and result.lyrics:
                            # Check if it's LRC format (synced)
                            if '[' in result.lyrics and ']' in result.lyrics[:10]:
                                synced_lyrics = result.lyrics
                                logger.info(f"syncedlyrics: Found synced lyrics via {result.provider}")
                            else:
                                # Unsynced fallback
                                if not plain_lyrics:  # Only if we don't have plain from YTMusic
                                    plain_lyrics = result.lyrics
                                    logger.info(f"syncedlyrics: Found plain lyrics via {result.provider}")
                else:
                    logger.info("syncedlyrics package not installed")

            except Exception as e:
                logger.warning(f"syncedlyrics fetch failed: {str(e)}")

        # Save lyrics to output directory
        if synced_lyrics:
            lyrics_path = output_dir / "lyrics.lrc"
            lyrics_path.write_text(synced_lyrics, encoding="utf-8")
            lyrics_info["has_synced_lyrics"] = True
            logger.info(f"Saved synced lyrics to {lyrics_path}")

        if plain_lyrics:
            lyrics_txt_path = output_dir / "lyrics.txt"
            lyrics_txt_path.write_text(plain_lyrics, encoding="utf-8")
            lyrics_info["has_plain_lyrics"] = True
            logger.info(f"Saved plain lyrics to {lyrics_txt_path}")

        if not synced_lyrics and not plain_lyrics:
            logger.info("No lyrics available from any source")

        return lyrics_info

    async def download(
        self,
        job_id: str,
        url: str,
        output_dir: Optional[str] = None,
        audio_format: str = "m4a",
        quality: str = "high",
    ) -> dict:
        """Download audio from YouTube Music URL using song folder structure."""
        try:
            job_manager.update_job(
                job_id,
                state=JobState.RUNNING,
                progress=10.0,
                message="Starting download...",
            )

            # Import yt-dlp (lazy import to avoid startup cost)
            from yt_dlp import YoutubeDL

            # Get config
            config = get_config()
            base_dir = Path(output_dir) if output_dir else config.downloads_dir
            base_dir.mkdir(parents=True, exist_ok=True)

            # Progress tracking
            progress_state = {"total": 0}

            def progress_hook(d):
                if d["status"] == "downloading":
                    total = d.get("_total_bytes") or d.get("_total_bytes_estimate") or 0
                    downloaded = d.get("downloaded_bytes", 0)
                    progress_state["total"] = total

                    # Map download progress to 30-80% range
                    if total > 0:
                        download_pct = (downloaded / total) * 50  # 50% of total
                        job_manager.update_job(
                            job_id,
                            progress=30.0 + download_pct,
                            message=f"Downloading... {downloaded}/{total} bytes",
                        )
                elif d["status"] == "finished":
                    job_manager.update_job(
                        job_id,
                        progress=80.0,
                        message="Converting with ffmpeg...",
                    )

            # First, extract metadata to get title
            job_manager.update_job(job_id, progress=15.0, message="Fetching metadata...")

            temp_opts = self._build_ytdlp_opts(
                song_folder=base_dir,
                audio_format=audio_format,
                quality=quality,
                progress_callback=progress_hook,
                player_clients=["default"],
            )
            temp_opts.update({
                "quiet": True,
                "no_warnings": True,
                "skip_download": True,
                "simulate": True,
            })

            info = None
            with YoutubeDL(temp_opts) as ydl:
                info = ydl.extract_info(url, download=False)

            if not info:
                raise Exception("Failed to fetch video metadata")

            title = info.get("title", "Unknown")
            video_id = info.get("id")

            # Create song folder
            song_folder = config.get_song_folder(title)
            song_folder.mkdir(parents=True, exist_ok=True)

            job_manager.update_job(
                job_id,
                progress=20.0,
                message=f"Downloading: {title}...",
            )

            info = None
            attempt_errors = []
            for index, attempt in enumerate(self._download_attempts(), start=1):
                job_manager.update_job(
                    job_id,
                    progress=20.0 + index,
                    message=f"Downloading with yt-dlp: {attempt['label']}...",
                )
                try:
                    ytdlp_opts = self._build_ytdlp_opts(
                        song_folder=song_folder,
                        audio_format=audio_format,
                        quality=quality,
                        progress_callback=progress_hook,
                        use_cookies=attempt["use_cookies"],
                        player_clients=attempt["player_clients"],
                    )
                    with YoutubeDL(ytdlp_opts) as ydl:
                        info = ydl.extract_info(url, download=True)
                    break
                except Exception as attempt_error:
                    attempt_errors.append(f"{attempt['label']}: {clean_ytdlp_error(str(attempt_error))}")

            if not info:
                raise Exception(
                    "All yt-dlp download attempts failed. "
                    "This usually means YouTube requires authenticated browser cookies for this video/network. "
                    "Set YTDLP_COOKIEFILE to an exported cookies.txt file, or set YTDLP_COOKIES_BROWSER to a browser where YouTube is signed in.\n"
                    + "\n".join(attempt_errors)
                )

            job_manager.update_job(
                job_id,
                progress=85.0,
                message="Saving metadata...",
            )

            # Create metadata.json
            self._create_metadata_file(info, song_folder)

            # Fetch lyrics (pass metadata for syncedlyrics fallback)
            job_manager.update_job(
                job_id,
                progress=90.0,
                message="Fetching lyrics...",
            )
            # Prepare metadata dict for syncedlyrics
            metadata_for_lyrics = {
                "title": info.get("title"),
                "artist": info.get("artist") or info.get("uploader"),
            }
            lyrics_info = self._fetch_lyrics(video_id, song_folder, metadata_for_lyrics)

            # Update metadata with lyrics info
            metadata_path = song_folder / "metadata.json"
            if metadata_path.exists():
                with open(metadata_path, "r", encoding="utf-8") as f:
                    metadata = json.load(f)
                metadata.update(lyrics_info)
                with open(metadata_path, "w", encoding="utf-8") as f:
                    json.dump(metadata, f, indent=2, ensure_ascii=False)

            # Find the downloaded audio file
            from ..utils.path_helpers import find_audio_file
            audio_file = find_audio_file(song_folder)

            if not audio_file:
                raise Exception("Downloaded file not found")

            result = {
                "song_folder": str(song_folder),
                "audio_file": str(audio_file),
                "title": info.get("title"),
                "artist": info.get("artist") or info.get("uploader"),
                "duration": info.get("duration"),
                "file_size": audio_file.stat().st_size,
                "has_lyrics": lyrics_info["has_plain_lyrics"],
                "has_synced_lyrics": lyrics_info["has_synced_lyrics"],
            }

            job_manager.update_job(
                job_id,
                state=JobState.COMPLETED,
                progress=100.0,
                message="Download completed",
                result=result,
            )

            return result

        except Exception as e:
            job_manager.update_job(
                job_id,
                state=JobState.FAILED,
                error=str(e),
                message=f"Download failed: {str(e)}",
            )
            return {"error": str(e)}


def clean_ytdlp_error(message: str) -> str:
    return (
        message
        .replace("\x1b[0;31m", "")
        .replace("\x1b[0m", "")
        .replace("ERROR:", "ERROR:")
    )
