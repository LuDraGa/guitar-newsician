from __future__ import annotations
from dataclasses import dataclass, field, asdict
from typing import Any, Dict, List, Optional, Tuple
from pathlib import Path
import json
import hashlib
import time
from pathlib import Path
import essentia
import essentia.standard as es
import os

# Monkey patch a msaf error
import numpy as np, scipy as _scipy

setattr(_scipy, "inf", np.inf)
import msaf
from pydub import AudioSegment
import soundfile as sf

try:
    import madmom  # type: ignore

    _HAVE_MADMOM = True
except Exception:
    _HAVE_MADMOM = False

# -------- Config / IO ---------------------------------------------------------
DEFAULT_OUT_DIR = Path(__file__).parent.parent / "outputs" / "analysis" / "wav_music"
_HAVE_SF = False
_HAVE_PYDUB = True
_HAVE_ESSENTIA = True
_HAVE_MSAF = True


def _sha1(path: Path) -> str:
    h = hashlib.sha1()
    with open(path, "rb") as f:
        for chunk in iter(lambda: f.read(1 << 20), b""):
            h.update(chunk)
    return h.hexdigest()


def _write_json(path: Path, obj: Dict[str, Any]) -> None:
    path.parent.mkdir(parents=True, exist_ok=True)
    with open(path, "w", encoding="utf-8") as f:
        json.dump(obj, f, ensure_ascii=False, indent=2)


def _read_json(path: Path) -> Optional[Dict[str, Any]]:
    if not path.exists():
        return None
    try:
        with open(path, "r", encoding="utf-8") as f:
            return json.load(f)
    except json.JSONDecodeError as e:
        print(f"⚠️  Warning: Corrupted JSON file at {path}, starting fresh: {e}")
        # Backup the corrupted file
        backup_path = path.with_suffix('.json.corrupted')
        try:
            path.rename(backup_path)
            print(f"📁 Moved corrupted file to {backup_path}")
        except Exception as rename_err:
            print(f"⚠️  Could not rename corrupted file: {rename_err}")
        return None


# -------- Base Interfaces ------------------------------------------------------
@dataclass
class AnalysisContext:
    wav_path: Path
    file_hash: str
    sr: int
    channels: int
    duration_sec: float


@dataclass
class AnalyzerReport:
    name: str
    version: str
    elapsed_sec: float
    ok: bool
    error: Optional[str] = None
    data: Dict[str, Any] = field(default_factory=dict)


class Analyzer:
    """Base class; override `analyze`."""

    NAME = "base"
    VERSION = "0.1.0"

    def available(self) -> bool:
        return True

    def analyze(self, ctx: AnalysisContext) -> AnalyzerReport:
        t0 = time.time()
        try:
            data = self._run(ctx)
            # print(ctx)
            # print(data)
            return AnalyzerReport(
                self.NAME, self.VERSION, time.time() - t0, True, None, data
            )
        except Exception as e:
            return AnalyzerReport(
                self.NAME, self.VERSION, time.time() - t0, False, str(e), {}
            )

    def _run(self, ctx: AnalysisContext) -> Dict[str, Any]:
        raise NotImplementedError


# -------- Load WAV + basic stats ----------------------------------------------
def load_wav_context(wav_path: Path) -> AnalysisContext:
    wav_path = Path(wav_path)
    if not wav_path.exists():
        raise FileNotFoundError(wav_path)

    if _HAVE_SF:
        info = sf.info(str(wav_path))
        sr = int(info.samplerate)
        channels = int(info.channels)
        duration = float(info.duration)
    elif _HAVE_PYDUB:
        seg = AudioSegment.from_file(wav_path)
        sr = int(seg.frame_rate)
        channels = int(seg.channels)
        duration = float(len(seg) / 1000.0)
    else:
        raise RuntimeError("Need either `soundfile` or `pydub` to read WAV metadata.")

    return AnalysisContext(
        wav_path=wav_path,
        file_hash=_sha1(wav_path),
        sr=sr,
        channels=channels,
        duration_sec=duration,
    )


# -------- Analyzers (minimal but useful now) ----------------------------------


class BasicStatsAnalyzer(Analyzer):
    """Amplitude stats + rough RMS/peak; zero-crossing rate; mono check."""

    NAME = "basic_stats"
    VERSION = "0.1.0"

    def available(self) -> bool:
        return _HAVE_SF or _HAVE_PYDUB

    def _run(self, ctx: AnalysisContext) -> Dict[str, Any]:
        # Load PCM for quick stats (avoid huge memory for very long files: sample down if needed)
        if _HAVE_SF:
            x, sr = sf.read(str(ctx.wav_path), always_2d=False)
        elif _HAVE_PYDUB:
            seg = AudioSegment.from_file(ctx.wav_path)
            sr = seg.frame_rate
            # convert to float32 mono/stereo ndarray
            samples = seg.get_array_of_samples()
            import numpy as np

            x = np.array(samples).astype("float32") / (1 << 15)
            if seg.channels == 2:
                x = x.reshape((-1, 2))
        else:
            raise RuntimeError("No loader available")

        import numpy as np

        arr = x if x.ndim == 1 else x.mean(axis=1)
        peak = float(np.max(np.abs(arr))) if arr.size else 0.0
        rms = float(np.sqrt(np.mean(arr**2))) if arr.size else 0.0

        # simple ZCR
        zcr = float(((arr[:-1] * arr[1:]) < 0).mean()) if arr.size > 1 else 0.0

        return {
            "sr": sr,
            "channels": ctx.channels,
            "duration_sec": ctx.duration_sec,
            "peak_abs": peak,
            "rms": rms,
            "zcr": zcr,
        }


class TempoBeatsAnalyzer(Analyzer):
    """Essentia: global BPM, beat times, heuristic downbeats, tempo map."""

    NAME = "tempo_beats"
    VERSION = "0.2.0"

    def available(self) -> bool:
        return _HAVE_ESSENTIA

    def _run(self, ctx: AnalysisContext) -> Dict[str, Any]:
        # Load mono audio first
        loader = es.MonoLoader(filename=str(ctx.wav_path), sampleRate=ctx.sr)
        audio = loader()

        # Now run rhythm extractor on the audio vector
        # RhythmExtractor2013 ("multifeature") gives robust beats + BPM
        rx = es.RhythmExtractor2013(method="multifeature")
        bpm, beats, beat_conf, _, _ = rx(audio)  # ✅ passing VECTOR_REAL
        beats = [float(b) for b in beats]

        # tempo map: instantaneous tempo between consecutive beats
        tempo_map = []
        if len(beats) >= 2:
            for i in range(1, len(beats)):
                dt = beats[i] - beats[i - 1]
                if dt > 0:
                    tempo_map.append(60.0 / dt)
                else:
                    tempo_map.append(float(bpm))
        # simple meter guess: assume 4/4 and mark every 4th as downbeat
        # if the first 2 bars are short/long, this is still a usable grid for editing
        downbeats = []
        if beats:
            # find the most common inter-beat multiple for a "bar" (very rough)
            # default to 4 if nothing sensible emerges
            meter = 4
            # downbeat = every meter-th beat starting at index 0
            for i, t in enumerate(beats):
                if i % meter == 0:
                    downbeats.append(t)

        return {
            "bpm": float(bpm),
            "beat_confidence": float(beat_conf),
            "beats_sec": beats,
            "downbeats_sec": downbeats,
            "tempo_map_bpm": tempo_map,
        }


class TonalKeyAnalyzer(Analyzer):
    """Essentia: key/scale/tuning + global HPCP summary."""

    NAME = "tonal_key"
    VERSION = "0.1.0"

    def available(self) -> bool:
        return _HAVE_ESSENTIA

    def _run(self, ctx: AnalysisContext) -> Dict[str, Any]:
        # Use Essentia's streaming/standard to compute HPCP + Key
        loader = es.MonoLoader(filename=str(ctx.wav_path), sampleRate=ctx.sr)
        audio = loader()
        # spectral → HPCP
        w = es.Windowing(type="blackmanharris62")
        spectrum = es.Spectrum()
        peaks = es.SpectralPeaks(
            orderBy="magnitude",
            magnitudeThreshold=0.0001,
            minFrequency=20,
            maxFrequency=3500,
            maxPeaks=60,
        )
        hpcp = es.HPCP(size=36, referenceFrequency=440, bandPreset=False)
        frame_gen = es.FrameGenerator(
            audio, frameSize=4096, hopSize=2048, startFromZero=True
        )
        import numpy as np

        hpcp_frames: List[np.ndarray] = []
        for frame in frame_gen:
            spec = spectrum(w(frame))
            f, m = peaks(spec)
            hpcp_frames.append(hpcp(f, m))
        if not hpcp_frames:
            return {"key": None, "scale": None, "strength": 0.0, "hpcp_mean": []}
        H = np.vstack(hpcp_frames)
        hpcp_mean = H.mean(axis=0).tolist()

        key_est = es.Key(profileType="temperley")  # robust general default
        # print("\n\n\n")
        # print(hpcp_mean)
        # print("\n\n\n")
        key, scale, strength, _ = key_est(hpcp_mean)
        # print("\n\n\n")
        # print(_)
        # print("\n\n\n")
        return {
            "key": key,
            "scale": scale,
            "strength": float(strength),
            "hpcp_mean": hpcp_mean,
        }


class StructureMSAFAnalyzer(Analyzer):
    """MSAF: segmentation + heuristics to map labels to verse/chorus/bridge/intro/outro."""

    NAME = "structure_msaf"
    VERSION = "0.2.0"

    def available(self) -> bool:
        return _HAVE_MSAF

    def _run(self, ctx: AnalysisContext) -> Dict[str, Any]:
        import tempfile
        import shutil

        est_times, est_labels = msaf.run.process(
            str(ctx.wav_path),
            boundaries_id="sf",
            labels_id="fmc2d",
        )
        times = [float(t) for t in est_times]
        labels = [str(l) for l in est_labels]

        # Cleanup MSAF temporary files (JAMS and estimations directory)
        # These are redundant - all useful data is in our analysis.json
        estimations_dir = ctx.wav_path.parent / "estimations"
        if estimations_dir.exists():
            shutil.rmtree(estimations_dir, ignore_errors=True)

        # Cleanup root-level features cache file
        features_tmp = Path.cwd() / ".features_msaf_tmp.json"
        if features_tmp.exists():
            features_tmp.unlink(missing_ok=True)

        # build segments [start,end,label]
        segs = []
        for i in range(len(labels)):
            start = times[i]
            end = times[i + 1] if i + 1 < len(times) else ctx.duration_sec
            segs.append({"start_sec": start, "end_sec": end, "label": labels[i]})

        # heuristics:
        # - most total duration → "chorus"
        # - next most frequent recurring label → "verse"
        # - unique mid-track label → "bridge"
        # - first short unique → "intro"
        # - last short unique → "outro"
        from collections import defaultdict

        dur_by_label = defaultdict(float)
        count_by_label = defaultdict(int)
        for s in segs:
            d = max(0.0, s["end_sec"] - s["start_sec"])
            dur_by_label[s["label"]] += d
            count_by_label[s["label"]] += 1

        if not segs:
            return {
                "boundaries_sec": times,
                "labels": labels,
                "segments": [],
                "mapped_segments": [],
            }

        # ranking by total duration desc
        ranked = sorted(dur_by_label.items(), key=lambda x: (-x[1], x[0]))
        chorus_lbl = ranked[0][0] if ranked else None

        # verse candidate = most frequent recurring that's not chorus
        recurring = [
            lbl for lbl, cnt in count_by_label.items() if cnt >= 2 and lbl != chorus_lbl
        ]
        verse_lbl = None
        if recurring:
            recurring.sort(key=lambda l: (-count_by_label[l], -dur_by_label[l]))
            verse_lbl = recurring[0]

        # map
        mapped = []
        n = len(segs)
        for idx, s in enumerate(segs):
            l = s["label"]
            tag = None
            if l == chorus_lbl:
                tag = "chorus"
            elif verse_lbl and l == verse_lbl:
                tag = "verse"
            else:
                # unique labels → intro/bridge/outro by position
                unique = count_by_label[l] == 1
                if unique:
                    if idx == 0:
                        tag = "intro"
                    elif idx == n - 1:
                        tag = "outro"
                    else:
                        tag = "bridge"
                else:
                    tag = "section"  # fallback
            mapped.append({**s, "section": tag})

        return {
            "boundaries_sec": times,
            "labels": labels,
            "segments": segs,
            "mapped_segments": mapped,
        }


# ---- Chord helpers -----------------------------------------------------------
_PITCH_NAMES = ["C", "C#", "D", "Eb", "E", "F", "F#", "G", "Ab", "A", "Bb", "B"]


def _rotate(lst, k):
    k = k % len(lst)
    return lst[-k:] + lst[:-k]


def _make_chord_templates(n_bins: int = 36) -> Dict[str, np.ndarray]:
    """
    Simple major/minor triad templates in HPCP space.
    We build 12 majors and 12 minors, each as a 36-d vector with energy at triad degrees.
    """
    import numpy as np

    bins_per_semitone = n_bins // 12

    def pitch_bin(semitone):
        # center bin for each semitone; spread to neighbors for tolerance
        c = semitone * bins_per_semitone + bins_per_semitone // 2
        return int(c)

    templates = {}
    for root in range(12):
        # Major: 0, +4, +7 semitones
        maj = np.zeros(n_bins, dtype=np.float32)
        for off in (0, 4, 7):
            b = pitch_bin((root + off) % 12)
            maj[b] = 1.0
        templates[f"{_PITCH_NAMES[root]}:maj"] = maj / (np.linalg.norm(maj) + 1e-8)

        # Minor: 0, +3, +7
        minv = np.zeros(n_bins, dtype=np.float32)
        for off in (0, 3, 7):
            b = pitch_bin((root + off) % 12)
            minv[b] = 1.0
        templates[f"{_PITCH_NAMES[root]}:min"] = minv / (np.linalg.norm(minv) + 1e-8)
    return templates


def _best_chord_for_hpcp(
    vec: np.ndarray, templates: Dict[str, np.ndarray]
) -> Tuple[str, float]:
    import numpy as np

    v = vec.astype(np.float32)
    n = np.linalg.norm(v)
    if n < 1e-9:
        return ("N", 0.0)  # no-chord
    v = v / n
    best, best_sim = "N", 0.0
    for name, tmpl in templates.items():
        sim = float(np.dot(v, tmpl))
        if sim > best_sim:
            best, best_sim = name, sim
    return (best, best_sim)


def _transpose_chord(name: str, semitones: int) -> str:
    if name == "N":
        return name
    if ":" not in name:
        return name
    root, qual = name.split(":")
    try:
        idx = _PITCH_NAMES.index(root)
    except ValueError:
        return name
    new_idx = (idx + semitones) % 12
    return f"{_PITCH_NAMES[new_idx]}:{qual}"


def _interval_to_target_key(src_key: str, dst_key: str) -> int:
    """Return semitone shift to move roots from src_key → dst_key (use absolute pitch names)."""
    try:
        si = _PITCH_NAMES.index(src_key)
        di = _PITCH_NAMES.index(dst_key)
        return (di - si) % 12
    except ValueError:
        return 0


class ChordInferenceAnalyzer(Analyzer):
    """
    HPCP-based chord recognition with simple Maj/Min templates.
    Produces per-frame chords, a compressed progression, and an optional transposition map.
    """

    NAME = "chords"
    VERSION = "0.1.0"

    def available(self) -> bool:
        return _HAVE_ESSENTIA

    def _run(self, ctx: AnalysisContext) -> Dict[str, Any]:
        # build HPCP frames (same parameters as TonalKeyAnalyzer so they align)
        loader = es.MonoLoader(filename=str(ctx.wav_path), sampleRate=ctx.sr)
        audio = loader()
        w = es.Windowing(type="blackmanharris62")
        spectrum = es.Spectrum()
        peaks = es.SpectralPeaks(
            orderBy="magnitude",
            magnitudeThreshold=0.0001,
            minFrequency=20,
            maxFrequency=3500,
            maxPeaks=60,
        )
        n_bins = 36
        hpcp = es.HPCP(size=n_bins, referenceFrequency=440, bandPreset=False)
        frameSize, hopSize = 4096, 2048

        import numpy as np

        frame_gen = es.FrameGenerator(
            audio, frameSize=frameSize, hopSize=hopSize, startFromZero=True
        )
        hpcp_frames: List[np.ndarray] = []
        for frame in frame_gen:
            spec = spectrum(w(frame))
            f, m = peaks(spec)
            hpcp_frames.append(hpcp(f, m))

        if not hpcp_frames:
            return {"frames_hz": ctx.sr / hopSize, "progression": [], "per_frame": []}

        H = np.vstack(hpcp_frames)  # (T, 36)
        frames_hz = ctx.sr / hopSize
        templates = _make_chord_templates(n_bins=n_bins)

        # frame-wise chord classification
        per_frame: List[Tuple[float, str, float]] = []  # (time_sec, chord, conf)
        for i in range(H.shape[0]):
            chord, conf = _best_chord_for_hpcp(H[i], templates)
            t = i / frames_hz
            per_frame.append((float(t), chord, float(conf)))

        # compress to time-ranged progression (merge consecutive identical chords)
        progression: List[Dict[str, Any]] = []
        if per_frame:
            cur_chord = per_frame[0][1]
            cur_conf = [per_frame[0][2]]
            cur_start = per_frame[0][0]
            for t, ch, cf in per_frame[1:]:
                if ch == cur_chord:
                    cur_conf.append(cf)
                else:
                    progression.append(
                        {
                            "start_sec": float(cur_start),
                            "end_sec": float(t),
                            "chord": cur_chord,
                            "mean_conf": float(np.mean(cur_conf)),
                        }
                    )
                    cur_chord, cur_conf, cur_start = ch, [cf], t
            # flush last
            progression.append(
                {
                    "start_sec": float(cur_start),
                    "end_sec": float(per_frame[-1][0]),
                    "chord": cur_chord,
                    "mean_conf": float(np.mean(cur_conf)),
                }
            )

        # include a handy transposition map (12 semitone shifts) – no source key assumption needed
        transpose_map = {
            semis: [
                {**seg, "chord": _transpose_chord(seg["chord"], semis)}
                for seg in progression
            ]
            for semis in range(0, 12)
        }

        # OPTIONAL: transpose progression to a specific target key via env var
        # Re-estimate key from HPCP mean so this analyzer is self-contained.
        key_est = es.Key(profileType="temperley")
        src_key, src_scale, src_strength, _ = key_est(H.mean(axis=0))
        target_key = os.getenv("TRANSPOSE_TO_KEY")  # e.g., "A", "Bb", "F#", "C"
        transposed_to_key = None
        if target_key:
            shift = _interval_to_target_key(src_key, target_key)
            transposed_to_key = {
                "source_key": src_key,
                "target_key": target_key,
                "semitone_shift": int(shift),
                "progression": [
                    {**seg, "chord": _transpose_chord(seg["chord"], shift)}
                    for seg in progression
                ],
            }

        return {
            "frames_hz": float(frames_hz),
            "per_frame": [{"t": t, "chord": c, "conf": cf} for (t, c, cf) in per_frame],
            "progression": progression,
            "transpose_map": transpose_map,
            "transposed_to_key": transposed_to_key,  # <- None if not requested
        }


# -------- Registry / Orchestrator ---------------------------------------------

ANALYZERS: List[Analyzer] = [
    BasicStatsAnalyzer(),
    TempoBeatsAnalyzer(),  # now Essentia-based
    TonalKeyAnalyzer(),
    ChordInferenceAnalyzer(),  # NEW
    StructureMSAFAnalyzer(),  # with human-ish mapping
]


def list_analyzers() -> List[Tuple[str, bool]]:
    return [(a.NAME, a.available()) for a in ANALYZERS]


def run_analysis(
    wav_path: Path,
    out_dir: Path = DEFAULT_OUT_DIR,
    enable: Optional[List[str]] = None,
    disable: Optional[List[str]] = None,
    progress_callback=None,
) -> Path:
    """
    Runs all (or filtered) analyzers on a WAV and writes a single JSON:
      outputs/analysis/<stem>.analysis.json
    """
    ctx = load_wav_context(wav_path)
    stem = ctx.wav_path.stem
    out_path = out_dir / f"{stem}.analysis.json"

    # load existing to allow incremental updates
    aggregate = _read_json(out_path) or {}
    aggregate.setdefault(
        "_meta",
        {
            "source": str(ctx.wav_path),
            "file_hash": ctx.file_hash,
            "sr": ctx.sr,
            "channels": ctx.channels,
            "duration_sec": ctx.duration_sec,
            "created_at": time.strftime("%Y-%m-%d %H:%M:%S"),
        },
    )

    # filter analyzers
    enabled_set = set(enable) if enable else None
    disabled_set = set(disable) if disable else set()

    for a in ANALYZERS:
        if enabled_set is not None and a.NAME not in enabled_set:
            continue
        if a.NAME in disabled_set:
            continue
        if not a.available():
            aggregate[a.NAME] = {
                "ok": False,
                "error": f"dependency_missing_for_{a.NAME}",
            }
            if progress_callback:
                progress_callback(a.NAME, "skipped", "dependency missing")
            continue

        if progress_callback:
            progress_callback(a.NAME, "running", "")

        rep = a.analyze(ctx)
        aggregate[a.NAME] = {
            "ok": rep.ok,
            "version": rep.version,
            "elapsed_sec": rep.elapsed_sec,
            "error": rep.error,
            "data": rep.data,
        }

        if progress_callback:
            status = "completed" if rep.ok else "failed"
            progress_callback(a.NAME, status, rep.error or "")

    _write_json(out_path, aggregate)
    return out_path


# -------- Main Entry Point ----------------------------------------------------

def main():
    """
    Main entry point - customize for your use case.

    Examples:
        # List available analyzers
        for name, available in list_analyzers():
            print(f"{name}: {'✓' if available else '✗'}")

        # Single file analysis
        output = run_analysis(
            wav_path=Path("song.wav"),
            out_dir=Path("outputs/analysis"),
        )

        # With analyzer filtering
        output = run_analysis(
            wav_path=Path("song.wav"),
            out_dir=DEFAULT_OUT_DIR,
            enable=["tempo_beats", "chords"],
        )
    """

    # CUSTOMIZE THIS SECTION FOR YOUR USE CASE
    # =========================================

    # Example: List available analyzers
    print("Available Analyzers:")
    for name, avail in list_analyzers():
        status = "[OK]" if avail else "[MISSING]"
        print(f"  {name:20} {status}")

    # Example: Analyze a single file
    # wav_path = Path("outputs/converted/audio2wav/song.wav")
    # if wav_path.exists():
    #     output = run_analysis(
    #         wav_path=wav_path,
    #         out_dir=DEFAULT_OUT_DIR,
    #         enable=None,  # Run all analyzers
    #         disable=None,
    #     )
    #     print(f"Analysis complete: {output}")


if __name__ == "__main__":
    main()
