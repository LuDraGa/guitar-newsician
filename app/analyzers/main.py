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
from rich.columns import Columns
from rich.rule import Rule
from rich.text import Text
from rich.prompt import Prompt, Confirm
from rich.live import Live
from rich import box
import json

from music_analysis import run_analysis, list_analyzers

console = Console()
CONFIG_PATH = Path(__file__).parent / "config.yaml"


# ============================================================================
# Configuration Model
# ============================================================================


class AnalyzerConfig(BaseModel):
    """Configuration for music analysis."""

    input_dir: Path = Field(default=Path("downloads"), description="Input directory with song folders")
    output_filename: str = Field(default="analysis.json", description="Output filename for analysis")
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

    return AnalyzerConfig(**data)


def find_analyzable_songs(input_dir: Path) -> List[Path]:
    """
    Find all song directories that have audio.wav files (already converted).

    Returns:
        List of song directory paths that contain audio.wav
    """
    if not input_dir.exists():
        return []

    analyzable = []
    for item in input_dir.iterdir():
        if not item.is_dir():
            continue

        wav_file = item / "audio.wav"
        if wav_file.exists():
            analyzable.append(item)

    return sorted(analyzable)


def display_song_selection(songs: List[Path], output_filename: str) -> Optional[Path]:
    """
    Display Rich TUI for song selection.

    Returns:
        Selected song directory path, or None if cancelled
    """
    if not songs:
        console.print("[red]No analyzable songs found![/red]")
        console.print("[yellow]Make sure songs have been converted to WAV first (audio.wav)[/yellow]")
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
    table.add_column("WAV File", style="green")
    table.add_column("Status", style="yellow")

    for idx, song_dir in enumerate(songs, start=1):
        wav_file = song_dir / "audio.wav"
        analysis_file = song_dir / output_filename
        status = "[dim]analyzed[/dim]" if analysis_file.exists() else "[bright_white]not analyzed[/bright_white]"

        table.add_row(
            str(idx),
            song_dir.name,
            wav_file.name,
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


def analyze_song(
    song_dir: Path,
    output_filename: str,
    enable: Optional[List[str]],
    disable: Optional[List[str]],
    skip_existing: bool
) -> Optional[Path]:
    """
    Analyze a song's WAV file and save results in the same directory.

    Returns:
        Path to analysis file if successful, None otherwise
    """
    wav_file = song_dir / "audio.wav"
    output_file = song_dir / output_filename

    if not wav_file.exists():
        console.print(f"[red]No audio.wav found in {song_dir.name}[/red]")
        return None

    # Check if analysis already exists
    if skip_existing and output_file.exists():
        console.print(f"[yellow]Analysis already exists for {song_dir.name}[/yellow]")

        # Ask if user wants to re-run specific analyzers
        rerun = Confirm.ask("[cyan]Re-run analysis?[/cyan]", default=False)

        if not rerun:
            console.print("[dim]Skipping analysis[/dim]")
            return output_file

        # Load existing analysis to show what's available
        try:
            existing_data = json.loads(output_file.read_text(encoding="utf-8"))
            available_analyzers = [k for k in existing_data.keys() if k != "_meta"]

            console.print()
            console.print("[cyan]Existing analyzers:[/cyan]")

            # Show existing analyzers with status
            status_table = Table(box=box.SIMPLE, show_header=True, header_style="bold")
            status_table.add_column("#", justify="right", style="cyan")
            status_table.add_column("Analyzer", style="white")
            status_table.add_column("Status", justify="center")

            for idx, name in enumerate(available_analyzers, start=1):
                analyzer_data = existing_data[name]
                if analyzer_data.get("ok"):
                    status = "[green]✓ OK[/green]"
                else:
                    status = "[red]✗ Failed[/red]"
                status_table.add_row(str(idx), name, status)

            console.print(status_table)
            console.print()

            # Ask which analyzers to re-run
            console.print("[cyan]Enter analyzer numbers to re-run (comma-separated), or 'all' for all:[/cyan]")
            console.print("[dim]Example: 1,3,5 or all[/dim]")

            choice = Prompt.ask("Analyzers to re-run", default="all")

            if choice.lower() == "all":
                enable = None  # Run all
                console.print("[yellow]Re-running all analyzers[/yellow]")
            else:
                # Parse selected numbers
                try:
                    selected_indices = [int(x.strip()) for x in choice.split(",")]
                    enable = [available_analyzers[i-1] for i in selected_indices if 0 < i <= len(available_analyzers)]
                    console.print(f"[yellow]Re-running: {', '.join(enable)}[/yellow]")
                except (ValueError, IndexError):
                    console.print("[red]Invalid selection, running all analyzers[/red]")
                    enable = None

        except Exception as e:
            console.print(f"[yellow]Could not read existing analysis: {e}[/yellow]")
            console.print("[yellow]Running all analyzers[/yellow]")
            enable = None

    try:
        console.print(f"[cyan]Analyzing {song_dir.name}...[/cyan]")
        console.print(f"  Input:  {wav_file.name}")
        console.print(f"  Output: {output_file.name}")
        console.print()

        # Get list of analyzers that will run
        all_analyzers = list_analyzers()
        enabled_set = set(enable) if enable else None
        disabled_set = set(disable) if disable else set()

        # Build analyzer status tracking
        analyzer_status = {}
        for name, available in all_analyzers:
            if enabled_set is not None and name not in enabled_set:
                continue
            if name in disabled_set:
                continue
            if not available:
                analyzer_status[name] = ("skipped", "dependency missing")
            else:
                analyzer_status[name] = ("pending", "")

        def create_status_table():
            """Create a status table showing analyzer progress."""
            table = Table(
                title=f"[bold cyan]Analyzing: {song_dir.name}[/bold cyan]",
                box=box.ROUNDED,
                show_header=True,
                header_style="bold"
            )
            table.add_column("Analyzer", style="white")
            table.add_column("Status", justify="center")
            table.add_column("Details", style="dim")

            for name, (status, details) in analyzer_status.items():
                if status == "pending":
                    status_display = "[dim]⏳ Pending[/dim]"
                elif status == "running":
                    status_display = "[yellow]▶ Running[/yellow]"
                elif status == "completed":
                    status_display = "[green]✓ Done[/green]"
                elif status == "failed":
                    status_display = "[red]✗ Failed[/red]"
                elif status == "skipped":
                    status_display = "[dim]⊘ Skipped[/dim]"
                else:
                    status_display = status

                table.add_row(name, status_display, details)

            return table

        def progress_callback(analyzer_name: str, status: str, details: str):
            """Update analyzer status."""
            analyzer_status[analyzer_name] = (status, details)

        # Run analysis with live progress display
        with Live(create_status_table(), console=console, refresh_per_second=4) as live:
            result_path = run_analysis(
                wav_file,
                out_dir=song_dir,
                enable=enable,
                disable=disable,
                progress_callback=lambda name, status, details: (
                    progress_callback(name, status, details),
                    live.update(create_status_table())
                )
            )

        # Rename to configured filename if different
        if result_path and result_path.name != output_filename:
            result_path.rename(output_file)
            result_path = output_file

        console.print()
        console.print(f"[green]✓ Successfully analyzed {song_dir.name}[/green]")
        console.print()

        return result_path

    except Exception as e:
        console.print(f"[red]✗ Failed to analyze {song_dir.name}: {e}[/red]")
        return None


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

    # Find analyzable songs (only those with audio.wav)
    songs = find_analyzable_songs(config.input_dir)

    if not songs:
        console.print(f"[red]No songs with audio.wav found in {config.input_dir}[/red]")
        console.print("[yellow]Convert songs to WAV first using the audio2wav converter[/yellow]")
        return

    # Display selection
    selected_song = display_song_selection(songs, config.output_filename)

    if not selected_song:
        return

    # Analyze
    result_path = analyze_song(
        selected_song,
        config.output_filename,
        config.enable_analyzers,
        config.disable_analyzers,
        config.skip_existing
    )

    if not result_path:
        console.print("[red]Analysis failed[/red]")
        raise SystemExit(1)

    # Show dashboard
    if config.show_dashboard and result_path.exists():
        console.print()
        render_dashboard(
            result_path,
            max_chords=config.max_chords,
            max_beats=config.max_beats,
            max_sections=config.max_sections
        )


if __name__ == "__main__":
    main()
