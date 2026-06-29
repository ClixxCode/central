# Central Design System

Central's UI is an original operational design system influenced by Linear's product UI: quiet navigation, dense task surfaces, restrained borders, compact controls, and strong keyboard/search affordances. It should feel fast and focused, not like a marketing page or decorative dashboard.

## Source Grounding

- Current app: Next.js, Tailwind v4, shadcn-style primitives, lucide icons, persistent sidebar, task tables, command/search, and light/dark themes.
- Public Linear references inspected with Firecrawl: redesign notes, UI refresh notes, docs screenshots, and public branding extraction.
- Authenticated Linear reference: user-provided screenshot of a light-mode issue list in Firecrawl Interact.
- Authenticated DOM/style extraction through Firecrawl was blocked by tenant policy because ZDR is not enabled for the Firecrawl account.
- Local test-workspace sampling was performed with [scripts/linear-style-extractor.js](/Users/aj/_clix/central/scripts/linear-style-extractor.js) in light and dark mode on `2026-06-27`.

## Principles

- Put work content first. Navigation is dimmer than the main content area.
- Favor dense rows, small controls, and low-chrome grouping over large cards.
- Use borders and subtle surface shifts before shadows.
- Use the primary accent sparingly for focus, selection, creation, and keyboard affordances.
- Keep light and dark themes structurally equivalent: same hierarchy, different luminance.
- Use lucide icons for controls and actions; keep icons 14-18px in dense surfaces.

## Core Tokens

The source of truth is [src/app/globals.css](/Users/aj/_clix/central/src/app/globals.css).

| Role | Token | Usage |
| --- | --- | --- |
| Canvas | `--background`, `--canvas` | Main app background and page-level surface. |
| Content | `--card`, `--surface` | Primary content panels, tables, and settings sections. |
| Raised | `--popover`, `--surface-raised` | Menus, command surfaces, dropdowns, dialogs. |
| Subtle | `--muted`, `--surface-sunken` | Empty states, inactive wells, secondary backgrounds. |
| Navigation | `--sidebar`, `--sidebar-border` | Persistent app navigation rail. |
| Interactive | `--primary`, `--ring` | Selection, focus, quick-create, active nav, links. |
| Rows | `--row-hover`, `--row-selected`, `--row-section` | Task list hover, selected rows, group headers. |
| Status | `--success`, `--warning`, `--info`, `--attention`, `--destructive` | Workflow state and metadata badges. |

## Theme Behavior

Light mode uses a near-white content canvas with a slightly dimmer navigation rail. The sampled Linear hierarchy was `lch(95.94% 0.5 282)` for the app frame, `lch(98.94% 0.5 282)` for the main work surface, and `#f5f5f5` for the sidebar. Central uses those as calibration points, with `#6d78d5` as the interaction/focus accent.

Dark mode uses a near-black app frame with raised content surfaces. The sampled hierarchy was `lch(9.236% 1.213 272.695)` for the app frame, `lch(12.236% 2.213 272.695)` for the main work surface, and `#090909` for the sidebar. Avoid mid-slate dashboards; the sidebar should recede and popovers should lift just enough to separate from the canvas.

## Component Rules

### App Shell

- Sidebar: `bg-sidebar`, `border-sidebar-border`, compact 40px collapsed targets, 32-40px expanded rows.
- Header: 56px height, low visual weight, search and quick-add as primary workflow affordances.
- Main content: `bg-background`, 16-24px page padding, dense tables/lists.

### Navigation

- Inactive items use muted text and a subtle hover fill.
- Active items use `bg-primary/10 text-primary font-medium`.
- Section labels are 12px uppercase with modest tracking; avoid heavy dividers unless needed.

### Buttons

- Default height: 36px. Dense/icon controls: 24-32px.
- Radius: 6-8px. Avoid pill buttons inside the app shell unless a component is explicitly a badge/chip.
- Primary actions should be rare and obvious. Secondary and ghost actions should carry most toolbar weight.

### Rows And Tables

- Rows should use compact vertical padding and clear hover states.
- Use `--row-section` for group headers and `--row-selected` for selected/multi-selected states.
- Prefer row metadata, small badges, and inline controls over nested cards.

### Cards And Panels

- Cards use 8px radius or less and no default decorative shadow.
- Use cards for repeated items, modals, and framed tools only. Page sections should be unframed layouts or full-width bands.

### Popovers, Menus, Dialogs

- Use `--surface-raised`/`--popover` and `--shadow-popover`.
- Keep menus compact: 32px-ish rows, 14px labels, 16px icons.
- Focus rings use `--ring`/`--shadow-focus`.

## Implementation Notes

- Prefer semantic classes (`bg-primary/10`, `bg-sidebar`, `border-border`, `text-muted-foreground`) over hard-coded palette utilities.
- Do not add new arbitrary colors unless they become named tokens.
- When adding new workflow states, map them to `success`, `warning`, `info`, `attention`, or `destructive` first.
- Keep component changes grounded in existing shadcn primitives under [src/components/ui](/Users/aj/_clix/central/src/components/ui).
