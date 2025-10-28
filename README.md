#### The theme of this codebase is to have the various scrapers, downloaders, converter and analyzer scripts in one place. Mostly just backend, with at best a super simplistic ui(No UX thoughts)

#### Bare Setup

1. uv package manager
2. pydantic: for models and typing
3. rich: for a nice terminal experience
4. pyyaml: for yaml based configs
5. python-dotenv: to read envs and work with them
6. uvicorn: This is the server
7. m4a -> wav -> midi
8. essentia vs librosa
9. msaf, madmom(facing issue with 3.12), pyACA(more experimental so not using currently)
10. music21
11. soundfile vs pydub
12. spleeter vs demucs

#### Downloaders

1. YT Audio Downloader: downloaders/yt_music_downloader
   1. uses yt-dlp
   2. runs in terminal
   3. has a configuration file for the ytdlp-opts
   4. **_`<span style="color:#E52B50">`Unique terminal dir selector `</span>`_**

#### Scrapers

- DEF: Scraper extracts specific, targeted data from web pages

#### Crawlers

- DEF: navigates and indexes websites to discover links and pages

#### Crons
