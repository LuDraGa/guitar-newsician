"""
Audio Analysis Tools for MIDI Agent System
Provides audio feature extraction tools that convert audio signals into
text/numerical descriptions that LLMs can reason about.
"""

from pathlib import Path
from typing import List, Optional, Dict, Tuple
from dataclasses import dataclass
import numpy as np
import librosa
import soundfile as sf


@dataclass
class PitchPoint:
    """Single pitch measurement at a point in time."""
    time: float  # seconds
    frequency: float  # Hz
    confidence: float  # 0-1


@dataclass
class OnsetEvent:
    """Note onset (attack) event."""
    time: float  # seconds
    strength: float  # 0-1


@dataclass
class BendEvent:
    """Pitch bend event detected in audio."""
    start_time: float
    end_time: float
    start_freq: float  # Hz
    end_freq: float  # Hz
    semitones: float  # pitch change in semitones
    direction: str  # "up" or "down"


@dataclass
class VibratoEvent:
    """Vibrato (periodic pitch modulation) event."""
    start_time: float
    end_time: float
    center_freq: float  # Hz
    rate: float  # Hz (oscillations per second)
    extent: float  # semitones (amplitude of vibrato)


@dataclass
class SpectralFeatures:
    """Spectral characteristics of audio section."""
    centroid_mean: float  # Hz
    rolloff_mean: float  # Hz
    flatness_mean: float  # 0-1
    energy: float


class AudioAnalyzer:
    """
    Audio analysis tools for agent-based MIDI editing.
    Converts audio signals into LLM-readable descriptions.
    """

    def __init__(self, sample_rate: int = 22050):
        """
        Initialize audio analyzer.

        Args:
            sample_rate: Target sample rate for analysis
        """
        self.sr = sample_rate

    def load_audio(self, audio_path: str) -> Tuple[np.ndarray, int]:
        """
        Load audio file.

        Args:
            audio_path: Path to audio file

        Returns:
            Tuple of (audio array, sample rate)
        """
        audio, sr = librosa.load(audio_path, sr=self.sr, mono=True)
        return audio, sr

    def extract_section(
        self,
        audio_path: str,
        start_time: float,
        end_time: float
    ) -> np.ndarray:
        """
        Extract audio section between time markers.

        Args:
            audio_path: Path to audio file
            start_time: Start time in seconds
            end_time: End time in seconds

        Returns:
            Audio array for the specified section
        """
        audio, sr = self.load_audio(audio_path)
        start_sample = int(start_time * sr)
        end_sample = int(end_time * sr)

        return audio[start_sample:end_sample]

    def pitch_tracking(
        self,
        audio: np.ndarray,
        fmin: float = 50.0,
        fmax: float = 2000.0
    ) -> List[PitchPoint]:
        """
        Track pitch over time using pYIN algorithm.

        Args:
            audio: Audio signal array
            fmin: Minimum frequency to detect (Hz)
            fmax: Maximum frequency to detect (Hz)

        Returns:
            List of pitch measurements over time
        """
        # Use pYIN for robust pitch tracking
        f0, voiced_flag, voiced_probs = librosa.pyin(
            audio,
            sr=self.sr,
            fmin=fmin,
            fmax=fmax,
            frame_length=2048
        )

        # Calculate time points
        hop_length = 512
        times = librosa.frames_to_time(
            np.arange(len(f0)),
            sr=self.sr,
            hop_length=hop_length
        )

        # Build pitch points
        pitch_points = []
        for t, freq, confidence in zip(times, f0, voiced_probs):
            if not np.isnan(freq):  # Only include voiced segments
                pitch_points.append(
                    PitchPoint(
                        time=float(t),
                        frequency=float(freq),
                        confidence=float(confidence)
                    )
                )

        return pitch_points

    def onset_detection(
        self,
        audio: np.ndarray,
        sensitivity: float = 0.5
    ) -> List[OnsetEvent]:
        """
        Detect note onsets (attacks) in audio.

        Args:
            audio: Audio signal array
            sensitivity: Detection sensitivity (0-1, higher = more onsets)

        Returns:
            List of onset events
        """
        # Detect onset frames
        onset_frames = librosa.onset.onset_detect(
            y=audio,
            sr=self.sr,
            units='frames',
            backtrack=True,
            delta=sensitivity
        )

        # Get onset strengths
        onset_env = librosa.onset.onset_strength(y=audio, sr=self.sr)

        # Convert to time and build events
        onset_times = librosa.frames_to_time(onset_frames, sr=self.sr)

        onsets = []
        for frame, time in zip(onset_frames, onset_times):
            strength = onset_env[frame] if frame < len(onset_env) else 0.0
            onsets.append(
                OnsetEvent(
                    time=float(time),
                    strength=float(strength)
                )
            )

        return onsets

    def spectral_analysis(self, audio: np.ndarray) -> SpectralFeatures:
        """
        Analyze spectral characteristics of audio.

        Args:
            audio: Audio signal array

        Returns:
            Spectral features
        """
        # Compute spectral features
        centroid = librosa.feature.spectral_centroid(y=audio, sr=self.sr)[0]
        rolloff = librosa.feature.spectral_rolloff(y=audio, sr=self.sr)[0]
        flatness = librosa.feature.spectral_flatness(y=audio)[0]

        # RMS energy
        rms = librosa.feature.rms(y=audio)[0]

        return SpectralFeatures(
            centroid_mean=float(np.mean(centroid)),
            rolloff_mean=float(np.mean(rolloff)),
            flatness_mean=float(np.mean(flatness)),
            energy=float(np.mean(rms))
        )

    def detect_pitch_bends(
        self,
        pitch_points: List[PitchPoint],
        min_bend_semitones: float = 0.5,
        min_duration: float = 0.05
    ) -> List[BendEvent]:
        """
        Detect pitch bend events from pitch tracking data.

        Args:
            pitch_points: List of pitch measurements
            min_bend_semitones: Minimum pitch change to consider a bend
            min_duration: Minimum bend duration in seconds

        Returns:
            List of detected bend events
        """
        if len(pitch_points) < 3:
            return []

        bends = []
        i = 0

        while i < len(pitch_points) - 1:
            start_point = pitch_points[i]

            # Look ahead for continuous pitch change
            j = i + 1
            while j < len(pitch_points):
                current = pitch_points[j]

                # Check if pitch is changing continuously
                if current.time - pitch_points[j-1].time > 0.1:  # Gap in tracking
                    break

                # Calculate semitone difference from start
                semitones = 12 * np.log2(current.frequency / start_point.frequency)

                # If we've found a significant bend
                if abs(semitones) >= min_bend_semitones:
                    duration = current.time - start_point.time

                    if duration >= min_duration:
                        bends.append(
                            BendEvent(
                                start_time=start_point.time,
                                end_time=current.time,
                                start_freq=start_point.frequency,
                                end_freq=current.frequency,
                                semitones=semitones,
                                direction="up" if semitones > 0 else "down"
                            )
                        )

                    # Skip past this bend
                    i = j
                    break

                j += 1

            i += 1

        return bends

    def detect_vibrato(
        self,
        pitch_points: List[PitchPoint],
        min_oscillations: int = 2
    ) -> List[VibratoEvent]:
        """
        Detect vibrato (periodic pitch oscillation) in audio.

        Args:
            pitch_points: List of pitch measurements
            min_oscillations: Minimum number of oscillations to detect

        Returns:
            List of vibrato events
        """
        if len(pitch_points) < 10:
            return []

        # Extract pitch values and times
        freqs = np.array([p.frequency for p in pitch_points])
        times = np.array([p.time for p in pitch_points])

        # Convert to semitones relative to mean
        mean_freq = np.mean(freqs)
        semitones = 12 * np.log2(freqs / mean_freq)

        # Find periodic oscillations using autocorrelation
        # This is a simplified vibrato detection
        vibratos = []

        # Use sliding window to find vibrato sections
        window_size = 20
        for i in range(0, len(semitones) - window_size, 5):
            window = semitones[i:i+window_size]

            # Check for oscillations (zero crossings)
            zero_crossings = np.where(np.diff(np.sign(window - np.mean(window))))[0]

            if len(zero_crossings) >= min_oscillations * 2:
                # Estimate vibrato rate
                time_span = times[i+window_size-1] - times[i]
                rate = len(zero_crossings) / (2 * time_span)  # Hz

                # Estimate extent (amplitude)
                extent = np.std(window)

                vibratos.append(
                    VibratoEvent(
                        start_time=float(times[i]),
                        end_time=float(times[i+window_size-1]),
                        center_freq=float(mean_freq),
                        rate=float(rate),
                        extent=float(extent)
                    )
                )

        return vibratos

    def describe_audio_features(
        self,
        pitch_points: List[PitchPoint],
        onsets: List[OnsetEvent],
        spectral: SpectralFeatures,
        bends: List[BendEvent],
        vibratos: List[VibratoEvent]
    ) -> str:
        """
        Convert audio features to LLM-readable text description.

        Args:
            pitch_points: Pitch tracking data
            onsets: Note onset events
            spectral: Spectral features
            bends: Pitch bend events
            vibratos: Vibrato events

        Returns:
            Human-readable description of audio features
        """
        lines = ["=== Audio Analysis ===\n"]

        # Pitch summary
        if pitch_points:
            freqs = [p.frequency for p in pitch_points]
            lines.append(f"Pitch Range: {min(freqs):.1f} Hz to {max(freqs):.1f} Hz")
            lines.append(f"Mean Pitch: {np.mean(freqs):.1f} Hz")
            lines.append(f"Pitch Stability: {np.std(freqs):.1f} Hz std dev")

        # Onset summary
        lines.append(f"\nNote Onsets Detected: {len(onsets)}")
        if onsets:
            onset_times = [f"{o.time:.2f}s" for o in onsets[:5]]
            lines.append(f"First onsets at: {', '.join(onset_times)}")

        # Bends
        if bends:
            lines.append(f"\nPitch Bends Detected: {len(bends)}")
            for bend in bends:
                lines.append(
                    f"  - {bend.start_time:.2f}s-{bend.end_time:.2f}s: "
                    f"{bend.start_freq:.1f}Hz → {bend.end_freq:.1f}Hz "
                    f"({bend.semitones:+.2f} semitones {bend.direction})"
                )
        else:
            lines.append("\nNo significant pitch bends detected")

        # Vibrato
        if vibratos:
            lines.append(f"\nVibrato Detected: {len(vibratos)} sections")
            for vib in vibratos:
                lines.append(
                    f"  - {vib.start_time:.2f}s-{vib.end_time:.2f}s: "
                    f"{vib.rate:.1f} Hz rate, {vib.extent:.2f} semitone extent"
                )

        # Spectral
        lines.append(f"\nSpectral Features:")
        lines.append(f"  - Brightness (centroid): {spectral.centroid_mean:.1f} Hz")
        lines.append(f"  - Rolloff frequency: {spectral.rolloff_mean:.1f} Hz")
        lines.append(f"  - Flatness: {spectral.flatness_mean:.3f}")
        lines.append(f"  - Energy: {spectral.energy:.3f}")

        return "\n".join(lines)

    def analyze_section(
        self,
        audio_path: str,
        start_time: float,
        end_time: float,
        fmin: float = 50.0,
        fmax: float = 2000.0
    ) -> Dict:
        """
        Complete analysis of an audio section.

        Args:
            audio_path: Path to audio file
            start_time: Section start time (seconds)
            end_time: Section end time (seconds)
            fmin: Minimum frequency for pitch tracking
            fmax: Maximum frequency for pitch tracking

        Returns:
            Dictionary with all analysis results
        """
        # Extract section
        audio = self.extract_section(audio_path, start_time, end_time)

        # Run all analyses
        pitch_points = self.pitch_tracking(audio, fmin, fmax)
        onsets = self.onset_detection(audio)
        spectral = self.spectral_analysis(audio)
        bends = self.detect_pitch_bends(pitch_points)
        vibratos = self.detect_vibrato(pitch_points)

        # Generate description
        description = self.describe_audio_features(
            pitch_points, onsets, spectral, bends, vibratos
        )

        return {
            "pitch_points": pitch_points,
            "onsets": onsets,
            "spectral": spectral,
            "bends": bends,
            "vibratos": vibratos,
            "description": description
        }
