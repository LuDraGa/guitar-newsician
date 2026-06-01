"""
WAV to MIDI Converter Module
Converts audio files to MIDI using Spotify's basic-pitch.
"""

from .wav2midi_converter import (
    Wav2MidiConfig,
    load_config,
    convert_wav_to_midi,
    convert_song_to_midi,
    find_audio_files,
)

__all__ = [
    "Wav2MidiConfig",
    "load_config",
    "convert_wav_to_midi",
    "convert_song_to_midi",
    "find_audio_files",
]
