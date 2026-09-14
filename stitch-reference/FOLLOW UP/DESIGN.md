---
name: Controlled Operational Neo-Brutalist
colors:
  surface: '#f6fafe'
  surface-dim: '#d6dade'
  surface-bright: '#f6fafe'
  surface-container-lowest: '#ffffff'
  surface-container-low: '#f0f4f8'
  surface-container: '#eaeef2'
  surface-container-high: '#e4e9ed'
  surface-container-highest: '#dfe3e7'
  on-surface: '#171c1f'
  on-surface-variant: '#464555'
  inverse-surface: '#2c3134'
  inverse-on-surface: '#edf1f5'
  outline: '#777587'
  outline-variant: '#c7c4d8'
  surface-tint: '#4d44e3'
  primary: '#3525cd'
  on-primary: '#ffffff'
  primary-container: '#4f46e5'
  on-primary-container: '#dad7ff'
  inverse-primary: '#c3c0ff'
  secondary: '#565e74'
  on-secondary: '#ffffff'
  secondary-container: '#dae2fd'
  on-secondary-container: '#5c647a'
  tertiary: '#005338'
  on-tertiary: '#ffffff'
  tertiary-container: '#006e4b'
  on-tertiary-container: '#67f4b7'
  error: '#ba1a1a'
  on-error: '#ffffff'
  error-container: '#ffdad6'
  on-error-container: '#93000a'
  primary-fixed: '#e2dfff'
  primary-fixed-dim: '#c3c0ff'
  on-primary-fixed: '#0f0069'
  on-primary-fixed-variant: '#3323cc'
  secondary-fixed: '#dae2fd'
  secondary-fixed-dim: '#bec6e0'
  on-secondary-fixed: '#131b2e'
  on-secondary-fixed-variant: '#3f465c'
  tertiary-fixed: '#6ffbbe'
  tertiary-fixed-dim: '#4edea3'
  on-tertiary-fixed: '#002113'
  on-tertiary-fixed-variant: '#005236'
  background: '#f6fafe'
  on-background: '#171c1f'
  surface-variant: '#dfe3e7'
typography:
  headline-lg:
    fontFamily: Space Grotesk
    fontSize: 22px
    fontWeight: '700'
    lineHeight: 28px
    letterSpacing: -0.02em
  headline-md:
    fontFamily: Space Grotesk
    fontSize: 16px
    fontWeight: '700'
    lineHeight: 22px
    letterSpacing: -0.01em
  headline-sm:
    fontFamily: Space Grotesk
    fontSize: 13px
    fontWeight: '700'
    lineHeight: 18px
    letterSpacing: 0.02em
  body-lg:
    fontFamily: Inter
    fontSize: 14px
    fontWeight: '500'
    lineHeight: 20px
  body-md:
    fontFamily: Inter
    fontSize: 12px
    fontWeight: '400'
    lineHeight: 16px
  body-sm:
    fontFamily: Inter
    fontSize: 11px
    fontWeight: '400'
    lineHeight: 14px
  label-lg:
    fontFamily: JetBrains Mono
    fontSize: 12px
    fontWeight: '600'
    lineHeight: 16px
    letterSpacing: 0.04em
  label-md:
    fontFamily: JetBrains Mono
    fontSize: 11px
    fontWeight: '500'
    lineHeight: 14px
    letterSpacing: 0.02em
  label-sm:
    fontFamily: JetBrains Mono
    fontSize: 10px
    fontWeight: '500'
    lineHeight: 12px
    letterSpacing: 0.05em
rounded:
  sm: 0.125rem
  DEFAULT: 0.25rem
  md: 0.375rem
  lg: 0.5rem
  xl: 0.75rem
  full: 9999px
spacing:
  gutter: 0.75rem
  margin: 1rem
  space-xs: 0.25rem
  space-sm: 0.375rem
  space-md: 0.75rem
  space-lg: 1rem
  space-xl: 1.5rem
---

## Brand & Style

This design system delivers an uncompromising, mission-critical workspace built specifically for security surveillance controllers, CCTV audit specialists, and operational intelligence dispatchers. The visual character merges the raw, structural integrity of Neo-Brutalism with high-density enterprise ergonomics—producing an environment that is authoritative, exact, and strictly utilitarian without veering into playful, quirky, or cartoonish aesthetics.

Key attributes of this operational posture:
- **Authoritative & Functional:** Visual real estate is prioritized for rapid telemetry, data scanning, and multi-stream incident documentation. Every line, frame, and accent serves a navigational or status-delineating purpose.
- **Architectural Edge:** Heavy reliance on solid, ultra-crisp borders (1.5px to 2px solid slate/black) and razor-sharp, zero-blur hard-drop shadows (2px to 3px) yields immediate visual segmentation across dense card clusters and split panes.
- **High-Velocity Contrast:** Deep obsidian-navy navigation structures contrast cleanly against cool industrial grey canvases, punctuated by functional status signifiers (Amber for capture, Emerald for resolved audit, Sky for synchronized documents, and Electric Indigo for command commits).
- **Reduced Latency Ergonomics:** Designed for high-stress, rapid shift handovers and live surveillance tracking where visual ambiguity must be zero.

## Colors

The system employs a high-contrast palette calibrated for 8-to-12-hour operator shifts. The visual hierarchy utilizes distinct tonal planes: an impenetrable dark command dock, a cool industrial canvas, and high-visibility status badges that act as cognitive landmarks.

### Palette Breakdown
- **Surface Canvas (`#F1F5F9` to `#F8FAFC`):** A calm, low-glare cool grey workspace base that prevents eye fatigue while providing high contrast against pure white cards.
- **Dark Structural Baseline (`#0F172A` / `#1E293B`):** Used for persistent sidebar navigation, primary structural frames, panel headers, and 2px component boundaries.
- **Command Accent (`#4F46E5` / `#6366F1`):** Electric Indigo reserved strictly for primary execution states, selected tab anchors, and critical submission buttons.
- **Status Indicator Tokens:**
  - **Screenshot / Capture Required (`#FEF08A` bg / `#854D0E` text / `#CA8A04` border):** Warm warning amber.
  - **Resolved / Done (`#DCFCE7` bg / `#14532D` text / `#16A34A` border):** Crisp tactical mint-emerald.
  - **Synchronized Docs (`#E0F2FE` bg / `#075985` text / `#0284C7` border):** Pure sky blue for external cloud assets.
  - **Urgent / Incident Reopen (`#FFE4E6` bg / `#9F1239` text / `#E11D48` border):** Clear crimson coral.

## Typography

The typographical structure is engineered as a functional trifecta:
1. **Space Grotesk** commands the top-tier structural headings, section dividers, and operational titles. Its mechanical, square grotesque architecture supplies immediate neo-brutalist presence without sacrificing corporate legitimacy.
2. **Inter** handles all narrative density—long-form remarks, supervisor notes, incident descriptions, and input field entries. Its neutral grotesque geometry ensures high legibility under dense visual packing.
3. **JetBrains Mono** governs time codes, CCTV coordinates, incident ID numbers, shift counters, and telemetry data. It prevents horizontal jitter when values dynamically tick or update.

All section labels (e.g., `01 EVENT & LOCATION`, `02 PARTIES INVOLVED`) must be formatted in uppercase JetBrains Mono with expanded letter-spacing to serve as structural indices across complex intake documents.

## Layout & Spacing

This layout system is built for dual-monitor or wide 1080p/1440p operator control consoles. It rejects excessive whitespace in favor of controlled, information-dense packing that minimizes scrolling during time-critical events.

### Desktop Topology
- **Global Structure:** A fixed-width tactical navigation rail (220px to 240px wide) docked along the left edge, coupled with a full-viewport operational body split into a two-column operational matrix (60/40 ratio).
- **Left Pane (Intake & Documentation):** Dedicated to high-speed data entry forms with numbered step barriers, nested selectors, and immediate media attachment targets.
- **Right Pane (Telemetry, Dispatch & History):** Contains live dispatch payloads, Google Docs synchronization statuses, and chronological records filtered by operational criteria.
- **Bottom Anchor:** Sticky command bar holding batch commit actions, sync hooks, and status confirmation triggers.

### Spacing Density
- Card paddings are constrained to `space-md` (12px) and `space-lg` (16px).
- Vertical stack separation between form input rows utilizes compact rhythm (`space-sm` to `space-md`), keeping the entire primary incident capture flow above the fold on typical 1080p monitors.

## Elevation & Depth

This design system deliberately excludes diffused, blurred drop shadows, ambient glow, and translucent frosted glassmorphism. Depth is created strictly through **hard-edge spatial displacement** and **bold structural outlines**:

- **Hard-Drop Offset (The Brutalist Stance):** Elevated interactive components (cards, primary buttons, docked dialogs, and active toolbars) cast a solid `#0F172A` drop shadow with `0px` blur:
  - Default Cards & Panels: `box-shadow: 2px 2px 0px 0px #0F172A;`
  - High-Priority Action Buttons: `box-shadow: 3px 3px 0px 0px #0F172A;`
  - Hover States: Translate element `(-1px, -1px)` and increment shadow to `3px 3px` or `4px 4px`.
  - Active/Pressed States: Translate element `(+2px, +2px)` to reduce shadow to `0px 0px`, simulating mechanical depression.
- **Border Hierarchy:**
  - Structural Canvas Outlines: 2px solid `#0F172A`.
  - Form Fields & Inset Containers: 1.5px solid `#1E293B`.
  - Nested Dividers & Section Breaklines: 1.5px solid `#E2E8F0` or `#0F172A`.

## Shapes

The design system enforces a controlled corner language (`roundedness: 1`). Rather than completely sharp `0px` industrial razor corners (which can induce interface fatigue) or bubble-like modern SaaS pills, standard elements utilize a disciplined `0.25rem` (4px) or `0.375rem` (6px) corner radius. 

- **Primary Cards and Outer Panes:** 6px radius (`rounded-md`) combined with a 2px solid dark border, delivering high architectural cohesion.
- **Input Fields, Select Triggers & Action Buttons:** 4px radius (`rounded-sm`).
- **Telemetry & Status Badges:** 3px to 4px radius, preserving tabular compactness.
- **Segmented Toggles & Dropdown Lists:** Flush, crisp edges with zero inner radiuses on shared borders to emphasize mechanical assembly.

## Components

### Buttons & Trigger Controls
- **Primary Operational Button:** Solid Electric Indigo (`#4F46E5`) fill, pure white bold text, 2px solid `#0F172A` border, and `2px 2px 0px #0F172A` hard offset shadow. On active click, the button shifts diagonally down-right to collapse the shadow.
- **Secondary / Utility Button:** Pure white (`#FFFFFF`) surface, charcoal `#0F172A` text and 1.5px border, hard `2px 2px 0px #0F172A` shadow. Hover triggers a subtle grey tint (`#F8FAFC`).
- **Destructive / Alert Action:** Coral/Rose surface (`#F43F5E`) or bordered outline with sharp red accent, clearly distinguished from informational buttons.

### Form Inputs & Data Selectors
- **Text & Area Fields:** White background, 1.5px solid `#1E293B` perimeter. On focus, the border thickens to 2px solid `#4F46E5` with an instant `2px 2px 0px #4F46E5` displacement.
- **Section Headers (Step Dividers):** Bold numerical prefix in JetBrains Mono inside a solid tag (e.g., `01`, `02`, `03`), followed by uppercase section title and a full-width horizontal rule (`1.5px solid #0F172A`).
- **Segmented Role/Target Switchers (e.g., `TL | OM` or `Agent/s | TL`):** Glued dual-button clusters wrapped in a 2px dark border where the active item inverts to solid `#0F172A` with crisp white text.

### Badges, Status Chips & Audit Tags
- Micro-pill geometry with 1.5px dark border.
- `SS (Screenshot)`: `#FEF08A` background with `#854D0E` mono text.
- `DONE / VERIFIED`: `#DCFCE7` background with `#14532D` mono text.
- `DOCS`: `#E0F2FE` background with `#075985` mono text.
- `REOPEN`: `#FFE4E6` background with `#9F1239` mono text.

### Log Rows & Record Cards
- Enclosed white rows with a 1.5px solid `#0F172A` border and `2px 2px 0px #0F172A` shadow.
- Left-edge functional status tags and incident time-markers anchored in monospace.
- Inline utility actions (`View SS`, `Send to Audit`, `Done`, `Edit`) organized in an aligned button group on the far right.

### Dropzone & Evidence Attachments
- Dashed 2px border (`#0F172A`) set against a subtle cool grey ground (`#F8FAFC`). Monospace instruction copy (`Drop image, Ctrl+V, or click to browse`) paired with instant thumbnail previews wrapped in 1.5px solid dark frames.