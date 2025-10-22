from pathlib import Path
from pydub import AudioSegment

DEFAULT_OUTPUT_DIR = (
    Path(__file__).parent.parent / "outputs" / "converted" / "audio2wav"
)
DEFAULT_TARGET_SR = 44100
SUPPORTED_FORMATS = ["m4a", "mp3", "flac", "aac", "ogg", "wav"]


def convert_to_wav(
    input_path: Path,
    output_dir: Path = DEFAULT_OUTPUT_DIR,
    target_sr: int = DEFAULT_TARGET_SR,
    mono: bool = True,
    overwrite: bool = False,
) -> Path:
    input_path = Path(input_path)
    output_dir.mkdir(parents=True, exist_ok=True)
    output_path = output_dir / (input_path.stem + ".wav")

    ext = input_path.suffix.lower().lstrip(".")
    if ext not in SUPPORTED_FORMATS:
        raise ValueError(f"Unsupported format: {ext}")

    if output_path.exists() and not overwrite:
        print(f"Skip (exists): {output_path.name}")
        return output_path

    audio = AudioSegment.from_file(input_path, format=ext)
    if mono:
        audio = audio.set_channels(1)

    # Ask ffmpeg to resample on export (more reliable than set_frame_rate)
    audio.export(output_path, format="wav", parameters=["-ar", str(target_sr)])
    print(f"Converted: {input_path.name} → {output_path.relative_to(Path.cwd())}")
    return output_path


def bulk_convert_to_wav(
    input_dir: Path = Path("downloads"),
    output_dir: Path = DEFAULT_OUTPUT_DIR,
    target_sr: int = DEFAULT_TARGET_SR,
    mono: bool = True,
    overwrite: bool = False,
):
    input_dir = Path(input_dir)
    files = [
        p
        for p in input_dir.iterdir()
        if p.suffix.lower().lstrip(".") in SUPPORTED_FORMATS
    ]
    for f in files:
        if f.suffix.lower() == ".wav" and not overwrite:
            # already wav; still ensure resample/mono if desired
            convert_to_wav(f, output_dir, target_sr, mono, overwrite)
        else:
            convert_to_wav(f, output_dir, target_sr, mono, overwrite)


# --- quick use (keeps your original flow, just broader and with SR) ---
if __name__ == "__main__":
    bulk_convert_to_wav(
        input_dir=Path("downloads"),
        mono=False,
    )
