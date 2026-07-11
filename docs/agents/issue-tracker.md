# Issue tracker: Local Markdown

Issues and PRDs for this repo live as markdown files in `.scratch/`.

## Conventions

- One feature per directory: `.scratch/<feature-slug>/`
- The PRD is `.scratch/<feature-slug>/PRD.md`
- Implementation issues are `.scratch/<feature-slug>/issues/<NN>-<slug>.md`, numbered from `01`
- Triage state is recorded as a `Status:` line near the top of each issue file (see `triage-labels.md` for the role strings)
- Comments and conversation history append to the bottom of the file under a `## Comments` heading

## When a skill says "publish to the issue tracker"

Create a new file under `.scratch/<feature-slug>/` (creating the directory if needed).

## When a skill says "fetch the relevant ticket"

Read the file at the referenced path. The user will normally pass the path or the issue number directly.

## Wayfinding operations (GitHub)

Wayfinder maps live on **GitHub issues** (`gh` CLI, repo `LuDraGa/guitar-newsician`), not in `.scratch/` — decided 2026-07-12 so maps are browsable on github.com.

- **The map** is one issue labelled `wayfinder:map`. Tickets are **native sub-issues** of the map (`addSubIssue` GraphQL mutation), each labelled `wayfinder:<type>` (`research` / `prototype` / `grilling` / `task`).
- **Blocking** is a `Blocked-by: #N` line in the ticket body (GitHub sub-issues carry parent-child, not blocked-by; the body line is the convention). The map body renders the full dependency graph.
- **Claim** = assign yourself to the ticket. **Frontier** = open + unassigned + every `Blocked-by` issue closed.
- **Resolve** = post the answer as a comment, close the issue, append a one-line pointer to the map's *Decisions so far*.
- Feature PRDs still start life under `.scratch/<feature-slug>/PRD.md` and get sliced to GitHub issues (e.g. `/to-issues`).
