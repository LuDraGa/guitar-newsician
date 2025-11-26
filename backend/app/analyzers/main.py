"""
WAV Music Analysis Runner
Analyze WAV files with Rich dashboard output (in-place processing).
"""

from __future__ import annotations
from pathlib import Path
from typing import List, Optional
import yaml
from pydantic import BaseModel, Field
from rich.console import Console
from rich.panel import Panel
from rich.table import Table
from rich.prompt import Prompt, Confirm
from rich.text import Text
from rich.columns import Columns
from rich.rule import Rule
from rich import box
import json

try:
    from .music_analysis import run_analysis, list_analyzers
except ImportError:
    from music_analysis import run_analysis, list_analyzers

console = Console()
CONFIG_PATH = Path(__file__).parent / "config.yaml"


# ============================================================================
# Configuration Model
# ============================================================================


class AnalyzerConfig(BaseModel):
    """Configuration for music analysis."""

    input_dir: Path = Field(default=Path("downloads"), description="Input directory with song folders")
    skip_existing: bool = Field(default=True, description="Skip files with existing analysis")
    workers: int = Field(default=4, description="Number of parallel workers")
    enable_analyzers: Optional[List[str]] = Field(default=None, description="Only run these analyzers")
    disable_analyzers: Optional[List[str]] = Field(default=None, description="Skip these analyzers")
    show_dashboard: bool = Field(default=True, description="Show Rich dashboard after analysis")
    max_chords: int = Field(default=10, description="Max chords to display")
    max_beats: int = Field(default=10, description="Max beats to display")
    max_sections: int = Field(default=10, description="Max sections to display")


def load_config() -> AnalyzerConfig:
    """Load configuration from YAML file."""
    if not CONFIG_PATH.exists():
        console.print(f"[yellow]Config not found at {CONFIG_PATH}, using defaults[/yellow]")
        return AnalyzerConfig()

    with open(CONFIG_PATH, "r") as f:
        data = yaml.safe_load(f)

    # Resolve input_dir relative to config file location if it's relative
    if "input_dir" in data:
        input_path = Path(data["input_dir"])
        if not input_path.is_absolute():
            data["input_dir"] = str((CONFIG_PATH.parent / input_path).resolve())

    return AnalyzerConfig(**data)


def find_analyzable_songs(input_dir: Path) -> List[Path]:
    """
    Find all song directories that have audio.wav files or stems.

    Returns:
        List of song directory paths that contain analyzable files
    """
    if not input_dir.exists():
        return []

    analyzable = []
    for item in input_dir.iterdir():
        if not item.is_dir():
            continue

        wav_file = item / "audio.wav"
        stems_dir = item / "stems"

        # Include if has base audio or stems
        if wav_file.exists() or (stems_dir.exists() and list(stems_dir.glob("*.wav"))):
            analyzable.append(item)

    return sorted(analyzable)


def display_song_selection(songs: List[Path]) -> Optional[Path]:
    """
    Display Rich TUI for song selection.

    Returns:
        Selected song directory path, or None if cancelled
    """
    if not songs:
        console.print("[red]No analyzable songs found![/red]")
        console.print("[yellow]Make sure songs have audio.wav or stems/[/yellow]")
        return None

    # Create selection table
    table = Table(
        title="Available Songs for Analysis",
        box=box.ROUNDED,
        show_header=True,
        header_style="bold cyan"
    )
    table.add_column("#", justify="right", style="cyan")
    table.add_column("Song Directory", style="white")
    table.add_column("Available Files", style="green")
    table.add_column("Analysis Status", style="yellow")

    for idx, song_dir in enumerate(songs, start=1):
        wav_file = song_dir / "audio.wav"
        stems_dir = song_dir / "stems"

        # Determine what files are available
        files_info = []
        if wav_file.exists():
            files_info.append("audio.wav")
        if stems_dir.exists():
            stem_files = list(stems_dir.glob("*.wav"))
            if stem_files:
                files_info.append(f"{len(stem_files)} stems")

        # Check analysis status
        base_analysis = song_dir / "analysis.json"
        stem_analyses = list(song_dir.glob("analysis_*.json"))

        status_parts = []
        if base_analysis.exists():
            status_parts.append("base")
        if stem_analyses:
            status_parts.append(f"{len(stem_analyses)} stems")

        status = "[dim]" + ", ".join(status_parts) + "[/dim]" if status_parts else "[bright_white]none[/bright_white]"

        table.add_row(
            str(idx),
            song_dir.name,
            ", ".join(files_info) if files_info else "[red]no files[/red]",
            status
        )

    console.print(table)
    console.print()

    # Prompt for selection
    choice = Prompt.ask(
        "[bold cyan]Select song to analyze[/bold cyan]",
        choices=[str(i) for i in range(1, len(songs) + 1)] + ["q"],
        default="q"
    )

    if choice == "q":
        console.print("[yellow]Analysis cancelled[/yellow]")
        return None

    return songs[int(choice) - 1]


def display_file_selection(song_dir: Path) -> Optional[List[tuple[str, Path, Path]]]:
    """
    Display file selection menu for a song (base audio and/or stems).

    Returns:
        List of (file_type, file_path, output_path) tuples to analyze, or None if cancelled
    """
    wav_file = song_dir / "audio.wav"
    stems_dir = song_dir / "stems"
    stem_files = sorted(stems_dir.glob("*.wav")) if stems_dir.exists() else []

    if not wav_file.exists() and not stem_files:
        console.print("[red]No analyzable files found![/red]")
        return None

    console.print()
    console.print(f"[bold cyan]Files available in {song_dir.name}:[/bold cyan]")
    console.print()

    # Create file selection table
    table = Table(box=box.ROUNDED, show_header=True, header_style="bold")
    table.add_column("#", justify="right", style="cyan")
    table.add_column("File", style="white")
    table.add_column("Type", style="green")
    table.add_column("Analysis Status", style="yellow")

    options = []
    idx = 1

    # Add base audio if exists
    if wav_file.exists():
        base_analysis = song_dir / "analysis.json"
        status = "[dim]analyzed[/dim]" if base_analysis.exists() else "[bright_white]not analyzed[/bright_white]"
        table.add_row(str(idx), "audio.wav", "Base Audio", status)
        options.append(("base", wav_file, base_analysis))
        idx += 1

    # Add stems if exist
    for stem_file in stem_files:
        stem_analysis = stems_dir / f"analysis_{stem_file.stem}.json"
        status = "[dim]analyzed[/dim]" if stem_analysis.exists() else "[bright_white]not analyzed[/bright_white]"
        table.add_row(str(idx), stem_file.name, "Stem", status)
        options.append(("stem", stem_file, stem_analysis))
        idx += 1

    console.print(table)
    console.print()

    # Show options
    console.print("[bold]Options:[/bold]")
    console.print("  • Enter numbers (comma-separated) to analyze specific files: [cyan]1,2,3[/cyan]")
    console.print("  • Enter [cyan]all[/cyan] to analyze all files")
    console.print("  • Enter [cyan]base[/cyan] to analyze only base audio")
    console.print("  • Enter [cyan]stems[/cyan] to analyze only stems")
    console.print("  • Enter [cyan]q[/cyan] to cancel")
    console.print()

    choice = Prompt.ask("What would you like to analyze?", default="q")

    if choice.lower() == "q":
        console.print("[yellow]Analysis cancelled[/yellow]")
        return None
    elif choice.lower() == "all":
        return options
    elif choice.lower() == "base":
        return [opt for opt in options if opt[0] == "base"]
    elif choice.lower() == "stems":
        return [opt for opt in options if opt[0] == "stem"]
    else:
        # Parse numbers
        try:
            selected_indices = [int(x.strip()) for x in choice.split(",")]
            selected = [options[i-1] for i in selected_indices if 0 < i <= len(options)]
            if not selected:
                console.print("[red]No valid selections[/red]")
                return None
            return selected
        except (ValueError, IndexError):
            console.print("[red]Invalid selection[/red]")
            return None


def analyze_files(
    song_dir: Path,
    files_to_analyze: List[tuple[str, Path, Path]],
    config: AnalyzerConfig
) -> List[Path]:
    """
    Analyze selected files.

    Args:
        song_dir: Song directory
        files_to_analyze: List of (file_type, file_path, output_path) tuples
        config: Analyzer configuration

    Returns:
        List of paths to successful analysis files
    """
    results = []

    for file_type, file_path, output_path in files_to_analyze:
        console.print()
        console.print(f"[cyan]Analyzing: {file_path.name}[/cyan]")

        # Check if already exists
        if config.skip_existing and output_path.exists():
            rerun = Confirm.ask(f"[yellow]Analysis exists for {file_path.name}. Re-run?[/yellow]", default=False)
            if not rerun:
                console.print("[dim]Skipping...[/dim]")
                results.append(output_path)
                continue

        try:
            # Determine output directory: stems go in stems/, base audio in song root
            output_dir = output_path.parent

            # Run analysis
            result_path = run_analysis(
                file_path,
                out_dir=output_dir,
                enable=config.enable_analyzers,
                disable=config.disable_analyzers,
            )

            if result_path:
                # Rename to correct output path if needed
                if result_path != output_path:
                    if output_path.exists():
                        output_path.unlink()
                    result_path.rename(output_path)

                results.append(output_path)
                console.print(f"[green]✓ Analysis complete: {output_path.name}[/green]")
            else:
                console.print(f"[red]✗ Analysis failed for {file_path.name}[/red]")

        except Exception as e:
            console.print(f"[red]✗ Error analyzing {file_path.name}: {e}[/red]")

    return results


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


def main():
    """Main entry point for interactive analysis."""
    console.print(Panel.fit(
        "[bold cyan]WAV Music Analyzer[/bold cyan]\n"
        "Analyze WAV files and generate detailed reports",
        border_style="cyan"
    ))
    console.print()

    # Load config
    config = load_config()
    console.print(f"[dim]Input directory: {config.input_dir}[/dim]")
    console.print(f"[dim]Analyzers: {config.enable_analyzers or 'all'}[/dim]")
    console.print()

    # Find analyzable songs
    songs = find_analyzable_songs(config.input_dir)

    if not songs:
        console.print(f"[red]No songs with audio.wav or stems/ found in {config.input_dir}[/red]")
        console.print("[yellow]Convert songs to WAV or separate stems first[/yellow]")
        return

    # Display song selection
    selected_song = display_song_selection(songs)

    if not selected_song:
        return

    # Display file selection
    files_to_analyze = display_file_selection(selected_song)

    if not files_to_analyze:
        return

    # Analyze selected files
    console.print()
    console.print(f"[bold cyan]Analyzing {len(files_to_analyze)} file(s)...[/bold cyan]")

    results = analyze_files(selected_song, files_to_analyze, config)

    if not results:
        console.print("[red]All analyses failed[/red]")
        raise SystemExit(1)

    console.print()
    console.print(f"[green]✓ Successfully analyzed {len(results)} file(s)[/green]")

    # Show dashboards if requested
    if config.show_dashboard:
        for result_path in results:
            console.print()
            render_dashboard(
                result_path,
                max_chords=config.max_chords,
                max_beats=config.max_beats,
                max_sections=config.max_sections
            )


if __name__ == "__main__":
    main()
