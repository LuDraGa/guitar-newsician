#### The theme of this codebase is to have the various scrapers, downloaders and converter scripts in one place. Mostly just backend, with at best a super simplistic ui(No UX thoughts)

#### Bare Setup

1. uv package manager
2. pydantic: for models and typing
3. rich: for a nice terminal experience
4. pyyaml: for yaml based configs
5. python-dotenv: to read envs and work with them
6. uvicorn: This is the server

#### Downloaders

1. YT Audio Downloader: downloaders/yt_music_downloader
   1. uses yt-dlp
   2. runs in terminal
   3. has a configuration file for the ytdlp-opts
   4. dir selector does not work
