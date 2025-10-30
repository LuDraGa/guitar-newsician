"""
WAV Music Analysis Runner
Batch analyze WAV files with parallel processing and Rich dashboard output.
"""

from __future__ import annotations
from pathlib import Path
from typing import List, Optional, Tuple
from concurrent.futures import ThreadPoolExecutor, as_completed
from pydantic import BaseModel, Field
from rich.console import Console
from rich.panel import Panel
from rich.table import Table
from rich.columns import Columns
from rich.rule import Rule
from rich.text import Text
from rich import box
import json

from music_analysis import run_analysis, DEFAULT_OUT_DIR as ANALYSIS_OUT

WAV_EXT = ".wav"
DEFAULT_WAV_DIR = Path(__file__).parent.parent / "outputs" / "converted" / "audio2wav"
console = Console()


# ============================================================================
# Configuration Model
# ============================================================================


class AnalysisConfig(BaseModel):
    """Configuration for batch WAV analysis."""

    # Input/Output
    input_path: Path = Field(
        default=DEFAULT_WAV_DIR, description="WAV file or directory"
    )
    output_dir: Path = Field(
        default=ANALYSIS_OUT, description="Analysis output directory"
    )

    # Processing
    recurse: bool = Field(default=False, description="Recurse into subdirectories")
    skip_existing: bool = Field(
        default=True, description="Skip files with existing analysis"
    )
    workers: int = Field(default=4, description="Number of parallel workers")

    # Analyzer filtering
    enable: Optional[List[str]] = Field(
        default=None, description="Only run these analyzers"
    )
    disable: Optional[List[str]] = Field(
        default=None, description="Skip these analyzers"
    )

    # Dashboard display
    show_dashboard: bool = Field(
        default=True, description="Show Rich dashboard after analysis"
    )
    max_chords: int = Field(
        default=10, description="Max chords to display in dashboard"
    )
    max_beats: int = Field(default=10, description="Max beats to display in dashboard")
    max_sections: int = Field(
        default=10, description="Max sections to display in dashboard"
    )


# ============================================================================
# Configuration Presets
# ============================================================================

# Quick analysis - only essential analyzers, no dashboard
QUICK_ANALYSIS = AnalysisConfig(
    skip_existing=True,
    workers=8,
    enable=["basic_stats", "tempo_beats"],
    show_dashboard=False,
)

# Full analysis - all analyzers with dashboard
FULL_ANALYSIS = AnalysisConfig(
    skip_existing=False,
    workers=4,
    show_dashboard=True,
    max_chords=20,
    max_beats=20,
    max_sections=15,
)

# Production analysis - optimized for large batches
PRODUCTION_ANALYSIS = AnalysisConfig(
    recurse=True,
    skip_existing=True,
    workers=16,
    show_dashboard=False,
)

# Chord-focused analysis
CHORD_ANALYSIS = AnalysisConfig(
    enable=["basic_stats", "tonal_key", "chords"],
    show_dashboard=True,
    max_chords=50,
)

# Structure-focused analysis
STRUCTURE_ANALYSIS = AnalysisConfig(
    enable=["basic_stats", "tempo_beats", "structure_msaf"],
    show_dashboard=True,
    max_sections=30,
)


# ============================================================================
# Core Functions
# ============================================================================


def find_wavs(path: Path, recurse: bool) -> List[Path]:
    """Find all WAV files in path (file or directory)."""
    path = Path(path)
    if path.is_file() and path.suffix.lower() == WAV_EXT:
        return [path]
    if path.is_dir():
        it = path.rglob("*") if recurse else path.iterdir()
        return sorted(p for p in it if p.is_file() and p.suffix.lower() == WAV_EXT)
    return []


def process_one(
    wav: Path,
    analysis_out: Path,
    enable: Optional[List[str]],
    disable: Optional[List[str]],
    skip_existing: bool,
) -> Tuple[Path, str, Optional[Path]]:
    """Process a single WAV file. Returns (source, status, output_path)."""
    out_json = analysis_out / f"{wav.stem}.analysis.json"
    if skip_existing and out_json.exists():
        return (wav, "skip_exists", out_json)
    out_path = run_analysis(wav, analysis_out, enable=enable, disable=disable)
    return (wav, "ok", out_path)


def _sec_to_mmss(x: Optional[float]) -> str:
    """Convert seconds to MM:SS format."""
    if x is None:
        return "--:--"
    m = int(x // 60)
    s = int(round(x - m * 60))
    return f"{m:02d}:{s:02d}"


def render_dashboard(
    json_path: Path, max_chords: int = 10, max_beats: int = 10, max_sections: int = 10
) -> None:
    """Render Rich dashboard for analysis results."""
    try:
        data = json.loads(json_path.read_text(encoding="utf-8"))
    except Exception as e:
        console.print(Panel.fit(f"[red]Failed to read {json_path.name}: {e}[/red]"))
        return

    meta = data.get("_meta", {})
    fn = Path(meta.get("source", json_path.stem)).name
    dur = meta.get("duration_sec")
    sr = meta.get("sr")
    ch = meta.get("channels")
    created = meta.get("created_at")

    # ---------- HEADER ----------
    header_left = Table.grid(padding=(0, 1))
    header_left.add_row("[bold cyan]File[/bold cyan]", Text(fn, overflow="fold"))
    header_left.add_row(
        "[bold cyan]Duration[/bold cyan]", _sec_to_mmss(dur) if dur is not None else "—"
    )
    header_left.add_row("[bold cyan]SR[/bold cyan]", str(sr) if sr else "—")
    header_left.add_row("[bold cyan]Channels[/bold cyan]", str(ch) if ch else "—")

    header_right = Table.grid(padding=(0, 1))
    bs = data.get("basic_stats", {}).get("data", {})
    header_right.add_row(
        "[bold magenta]RMS[/bold magenta]",
        f"{bs.get('rms', '—'):.4f}" if "rms" in bs else "—",
    )
    header_right.add_row(
        "[bold magenta]Peak[/bold magenta]",
        f"{bs.get('peak_abs', '—'):.4f}" if "peak_abs" in bs else "—",
    )
    header_right.add_row(
        "[bold magenta]ZCR[/bold magenta]",
        f"{bs.get('zcr', '—'):.4f}" if "zcr" in bs else "—",
    )
    header_right.add_row("[bold magenta]Created[/bold magenta]", created or "—")

    console.print(
        Panel(
            Columns([header_left, header_right], equal=True),
            title=f"[bold white]Analysis: {fn}[/bold white]",
            border_style="blue",
            box=box.ROUNDED,
        )
    )

    # ---------- TEMPO / BEATS ----------
    tb = data.get("tempo_beats", {})
    tbd = tb.get("data", {}) if tb.get("ok") else {}
    bpm = tbd.get("bpm")
    beats = tbd.get("beats_sec", []) or []
    downbeats = tbd.get("downbeats_sec", []) or []
    tempo_map = tbd.get("tempo_map_bpm", []) or []

    tempo_table = Table(box=box.SIMPLE_HEAVY, show_header=True, header_style="bold")
    tempo_table.add_column("BPM", justify="right")
    tempo_table.add_column("Beats", justify="right")
    tempo_table.add_column("Downbeats", justify="right")
    tempo_table.add_column("Avg Tempo", justify="right")
    tempo_table.add_column("Min/Max", justify="right")
    if bpm is not None:
        avg_t = sum(tempo_map) / len(tempo_map) if tempo_map else bpm
        minmax = f"{min(tempo_map):.1f}/{max(tempo_map):.1f}" if tempo_map else "—"
        tempo_table.add_row(
            f"{bpm:.1f}", str(len(beats)), str(len(downbeats)), f"{avg_t:.1f}", minmax
        )
    else:
        tempo_table.add_row("—", "—", "—", "—", "—")

    # Beat preview
    bp = Table(box=box.MINIMAL, show_header=True, header_style="bold dim")
    bp.add_column("First beats")
    bp.add_row(", ".join(_sec_to_mmss(b) for b in beats[:max_beats]) or "—")

    console.print(
        Panel(
            Columns([tempo_table, bp], equal=False, expand=True),
            title="[bold]Tempo / Beat Grid[/bold]",
            border_style="cyan",
            box=box.ROUNDED,
        )
    )

    # ---------- KEY ----------
    tk = data.get("tonal_key", {})
    tkd = tk.get("data", {}) if tk.get("ok") else {}
    key = tkd.get("key")
    scale = tkd.get("scale")
    strength = tkd.get("strength")
    key_panel = Panel(
        (
            f"[bold]Key:[/bold] {key or '—'}   "
            f"[bold]Scale:[/bold] {scale or '—'}   "
            f"[bold]Strength:[/bold] {strength:.2f}"
            if strength is not None
            else ""
        ),
        title="[bold]Tonal Key[/bold]",
        border_style="green",
        box=box.ROUNDED,
    )
    console.print(key_panel)

    # ---------- CHORDS ----------
    chd = data.get("chords", {})
    chords = chd.get("data", {}) if chd.get("ok") else {}
    prog = chords.get("progression", []) or []
    trans_to = chords.get("transposed_to_key")

    chord_table = Table(box=box.SIMPLE, show_header=True, header_style="bold")
    chord_table.add_column("#", justify="right")
    chord_table.add_column("Start")
    chord_table.add_column("End")
    chord_table.add_column("Chord")
    chord_table.add_column("Conf", justify="right")
    for i, seg in enumerate(prog[:max_chords], start=1):
        chord_table.add_row(
            str(i),
            _sec_to_mmss(seg.get("start_sec")),
            _sec_to_mmss(seg.get("end_sec")),
            seg.get("chord", "—"),
            f"{seg.get('mean_conf', 0.0):.2f}",
        )

    chord_panels = [
        Panel(
            chord_table,
            title="[bold]Chord Progression[/bold]",
            border_style="magenta",
            box=box.ROUNDED,
        )
    ]
    if trans_to:
        tt = Table(box=box.SIMPLE, show_header=True, header_style="bold")
        tt.add_column("Target Key")
        tt.add_column("Shift")
        tt.add_row(
            str(trans_to.get("target_key", "—")),
            str(trans_to.get("semitone_shift", "—")),
        )
        chord_panels.append(
            Panel(
                tt,
                title="[bold]Transposition[/bold]",
                border_style="magenta",
                box=box.ROUNDED,
            )
        )

    console.print(Columns(chord_panels, equal=False, expand=True))

    # ---------- SECTIONS ----------
    ms = data.get("structure_msaf", {})
    msd = ms.get("data", {}) if ms.get("ok") else {}
    mapped = msd.get("mapped_segments", []) or []
    seg_table = Table(box=box.SIMPLE_HEAVY, show_header=True, header_style="bold")
    seg_table.add_column("#", justify="right")
    seg_table.add_column("Start")
    seg_table.add_column("End")
    seg_table.add_column("Raw")
    seg_table.add_column("Section")
    for i, s in enumerate(mapped[:max_sections], start=1):
        seg_table.add_row(
            str(i),
            _sec_to_mmss(s.get("start_sec")),
            _sec_to_mmss(s.get("end_sec")),
            s.get("label", "—"),
            s.get("section", "—"),
        )

    console.print(
        Panel(
            seg_table,
            title="[bold]Sections (Mapped)[/bold]",
            border_style="yellow",
            box=box.ROUNDED,
        )
    )
    console.print(Rule(style="dim"))


def run_batch_analysis(
    config: AnalysisConfig,
) -> List[Tuple[Path, str, Optional[Path]]]:
    """
    Run batch analysis with given configuration.

    Returns:
        List of (source_path, status, output_path) tuples
    """
    wavs = find_wavs(config.input_path, config.recurse)
    if not wavs:
        console.print(f"[yellow]No .wav files found in {config.input_path}[/yellow]")
        return []

    console.print(f"[cyan]Found {len(wavs)} WAV file(s)[/cyan]")

    results = []
    with ThreadPoolExecutor(max_workers=max(1, config.workers)) as ex:
        futs = [
            ex.submit(
                process_one,
                wav=w,
                analysis_out=config.output_dir,
                enable=config.enable,
                disable=config.disable,
                skip_existing=config.skip_existing,
            )
            for w in wavs
        ]
        for fu in as_completed(futs):
            results.append(fu.result())

    ok = sum(1 for _, s, _ in results if s == "ok")
    skipped = sum(1 for _, s, _ in results if s != "ok")
    console.print(f"[green]Done. Processed={ok}, Skipped={skipped}[/green]")

    for src, status, outp in results:
        tag = "OK" if status == "ok" else status
        console.print(f"[{tag}] {src.name}" + (f" → {outp}" if outp else ""))

    if config.show_dashboard:
        for src, status, outp in results:
            if outp and Path(outp).exists():
                render_dashboard(
                    Path(outp),
                    max_chords=config.max_chords,
                    max_beats=config.max_beats,
                    max_sections=config.max_sections,
                )

    return results


# ============================================================================
# Main Entry Point
# ============================================================================


def main():
    """
    Main entry point - customize this for your use case.

    Examples:
        # Use preset
        run_batch_analysis(FULL_ANALYSIS)

        # Custom config
        config = AnalysisConfig(
            input_path=Path("my_wavs"),
            workers=8,
            enable=["tempo_beats", "chords"],
        )
        run_batch_analysis(config)

        # Modify preset
        config = QUICK_ANALYSIS.model_copy(update={"input_path": Path("my_wavs")})
        run_batch_analysis(config)
    """

    # CUSTOMIZE THIS SECTION FOR YOUR USE CASE
    # =========================================

    # Option 1: Use a preset configuration
    # config = FULL_ANALYSIS

    # Option 2: Custom configuration
    # config = AnalysisConfig(
    #     input_path=Path("outputs/converted/audio2wav"),
    #     output_dir=Path("outputs/analysis/wav_music"),
    #     recurse=False,
    #     skip_existing=True,
    #     workers=4,
    #     enable=None,  # Run all analyzers
    #     disable=None,
    #     show_dashboard=True,
    #     max_chords=15,
    #     max_beats=15,
    #     max_sections=15,
    # )

    # Option 3: Modify a preset
    config = FULL_ANALYSIS.model_copy(
        update={
            "input_path": Path("outputs/converted/audio2wav"),
            "workers": 32,
        }
    )

    run_batch_analysis(config)


if __name__ == "__main__":
    main()
