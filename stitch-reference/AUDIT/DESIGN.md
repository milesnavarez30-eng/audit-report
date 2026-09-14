---
name: Apex Surveillance Hub
colors:
  surface: '#10141a'
  surface-dim: '#10141a'
  surface-bright: '#353940'
  surface-container-lowest: '#0a0e14'
  surface-container-low: '#181c22'
  surface-container: '#1c2026'
  surface-container-high: '#262a31'
  surface-container-highest: '#31353c'
  on-surface: '#dfe2eb'
  on-surface-variant: '#ccc3d8'
  inverse-surface: '#dfe2eb'
  inverse-on-surface: '#2d3137'
  outline: '#958da1'
  outline-variant: '#4a4455'
  surface-tint: '#d2bbff'
  primary: '#d2bbff'
  on-primary: '#3f008e'
  primary-container: '#7c3aed'
  on-primary-container: '#ede0ff'
  inverse-primary: '#732ee4'
  secondary: '#7bd0ff'
  on-secondary: '#00354a'
  secondary-container: '#00a6e0'
  on-secondary-container: '#00374d'
  tertiary: '#4de082'
  on-tertiary: '#003919'
  tertiary-container: '#00773b'
  on-tertiary-container: '#84ffa6'
  error: '#ffb4ab'
  on-error: '#690005'
  error-container: '#93000a'
  on-error-container: '#ffdad6'
  primary-fixed: '#eaddff'
  primary-fixed-dim: '#d2bbff'
  on-primary-fixed: '#25005a'
  on-primary-fixed-variant: '#5a00c6'
  secondary-fixed: '#c4e7ff'
  secondary-fixed-dim: '#7bd0ff'
  on-secondary-fixed: '#001e2c'
  on-secondary-fixed-variant: '#004c69'
  tertiary-fixed: '#6dfe9c'
  tertiary-fixed-dim: '#4de082'
  on-tertiary-fixed: '#00210c'
  on-tertiary-fixed-variant: '#005227'
  background: '#10141a'
  on-background: '#dfe2eb'
  surface-variant: '#31353c'
typography:
  headline-xl:
    fontFamily: Space Grotesk
    fontSize: 32px
    fontWeight: '700'
    lineHeight: 38px
    letterSpacing: -0.02em
  headline-lg:
    fontFamily: Space Grotesk
    fontSize: 24px
    fontWeight: '700'
    lineHeight: 30px
    letterSpacing: -0.01em
  headline-md:
    fontFamily: Space Grotesk
    fontSize: 18px
    fontWeight: '600'
    lineHeight: 24px
    letterSpacing: 0em
  headline-sm:
    fontFamily: Space Grotesk
    fontSize: 14px
    fontWeight: '600'
    lineHeight: 18px
    letterSpacing: 0.02em
  body-lg:
    fontFamily: Inter
    fontSize: 14px
    fontWeight: '400'
    lineHeight: 20px
  body-md:
    fontFamily: Inter
    fontSize: 13px
    fontWeight: '400'
    lineHeight: 18px
  body-sm:
    fontFamily: Inter
    fontSize: 11px
    fontWeight: '400'
    lineHeight: 16px
  label-lg:
    fontFamily: JetBrains Mono
    fontSize: 13px
    fontWeight: '600'
    lineHeight: 16px
    letterSpacing: 0.04em
  label-md:
    fontFamily: JetBrains Mono
    fontSize: 11px
    fontWeight: '500'
    lineHeight: 14px
    letterSpacing: 0.05em
  label-sm:
    fontFamily: JetBrains Mono
    fontSize: 9px
    fontWeight: '700'
    lineHeight: 12px
    letterSpacing: 0.08em
spacing:
  gutter: 0.5rem
  margin: 0.75rem
  space-xs: 0.25rem
  space-sm: 0.375rem
  space-md: 0.5rem
  space-lg: 0.75rem
  space-xl: 1rem
---

## Brand & Style

This design system defines a mission-critical, dark-mode command center environment tailored for high-density surveillance operations, live stream telemetrics, and incident remediation. The aesthetic is strictly Controlled Neo-Brutalist: utilitarian, architectural, and razor-sharp. It rejects decorative glassmorphism, soft ambient blurs, and organic curves in favor of high-legibility status cues, dense information matrices, and industrial structural borders.

The UI evokes unyielding operational control, instant situational awareness, and total precision under cognitive pressure. Visual hierarchy is governed by stark contrast ratios, terminal-grade structural line work, and definitive color-coded operational signals designed to mitigate operator fatigue across continuous multi-monitor shifts.

## Colors

The palette operates strictly within high-contrast dark space, utilizing dark charcoal and deep slate containers framed by structural borders rather than fuzzy elevation.

### Core Canvas & Surfaces
- **Canvas Base:** `#0D1117` (Deepest charcoal/near-black ground layer)
- **Primary Panel Surface:** `#151B23` (Standard surface container for module shells and stream wrappers)
- **Secondary Surface:** `#1F2937` (Active card fills, inner table rows, sub-navigation strips)
- **Tertiary Surface:** `#21262D` (Input fields, inactive chip fills, and toolbars)

### Borders & Structural Dividers
- **Standard Structural Border:** `#30363D` (1.5px base outline for tiles, splitters, and frames)
- **Elevated Border:** `#484F58` (Hover states and active perimeter delineations)
- **High-Contrast Terminal Border:** `#E6EDF3` (Direct operator focus, selected camera feeds)

### Text & Glyphs
- **Text High Contrast:** `#E6EDF3` (Primary readouts, telemetry numbers, urgent logs)
- **Text Secondary:** `#8B949E` (Metadata labels, feed addresses, static metrics)
- **Text Muted:** `#6E7681` (Inactive timestamps, grid index indicators, deactivated cameras)

### Functional Operational Accents
- **Primary Command:** `#7C3AED` / `#6C5CE7` (Operator focus, command bar triggers, key action buttons)
- **Live / Stream Telemetry:** `#38BDF8` / `#5CE1E6` (Active streaming counters, layout switchers, audio decibels)
- **Active Nominal:** `#4ADE80` / `#A8FF78` (Camera connected, AI detection running, NOC pass)
- **Advisory Warning:** `#FB923C` (Loitering detected, high latency, operator inactivity warnings)
- **Critical Violation / Alert:** `#F87171` (Restricted zone breach, phone usage, link loss, destructive override)

## Typography

The typographic hierarchy separates structural commands from data density.

- **Space Grotesk** serves for module titles, primary status overlays, section tags, and panel banners, bringing a technical, neo-brutalist presence to layout headers.
- **Inter** handles high-volume readable prose, operator narrative logs, and multi-line incident write-ups with absolute clarity.
- **JetBrains Mono** governs live telemetrics, camera IDs, IP addresses, FPS/bitrate metrics, timestamps, and active status tags. All tabular and numerical data must use tabular lining figures to maintain column verticality during high-speed value updates.
- Use uppercase styling exclusively with `label-sm` and `label-md` when rendering CCTV channel IDs (`CAM-04-NORTH`), protocol statuses (`RTSP_OK`), and severity tags (`CRIT_ALERT`).

## Layout & Spacing

This layout adheres to a compact, multi-pane command-grid architecture designed to maximize visual payload per square pixel.

- **Grid Architecture:** 100vh viewport lock with zero outer canvas overflow. Flexible split containers allocate screen real estate across 12, 16, or 24 fractional units. Default surveillance layout reserves a collapsible 280px left rail (camera tree/NVR inventory), an active multi-feed center matrix (1x1, 2x2, 3x3, 4x4, or 1+5 focus layout), and a 340px right panel (real-time telemetry and incident alerts).
- **Rhythm & Padding:** Densities prioritize immediate data scanning. Padding within telemetry cells stays tight (`space-xs` to `space-sm`), while module margins use crisp `gutter` separation (`0.5rem` / `8px`) without large empty voids.
- **Responsive Adaptations:**
  - **Desktop (Multi-Screen NOC / 1080p to 4K):** Full multi-pane synchronous layout; grid gaps locked to `0.5rem`.
  - **Tablet (Field Supervisor / 768px - 1024px):** Feed matrices clamp to max 2x2; telemetry rail collapses into off-canvas right drawer triggered via sticky hotkey bar.
  - **Mobile (< 768px):** Single active stream view with bottom-docked event feed; navigation reflows to horizontal segmented bar.

## Elevation & Depth

Visual separation relies exclusively on hard-edged offsets and structural outlines, omitting diffuse gaussian blurs, glass translucency, or drop shadow gradients.

- **Surface Tiers:** Stacked depth relies on stepping container backgrounds: `#0D1117` (canvas ground) → `#151B23` (module panel) → `#1F2937` (active card/inner frame) → `#21262D` (input/interactive target).
- **Neo-Brutalist Hard Shadows:** Active overlays, flyout menus, and focused surveillance tiles project a rigid `2px 2px 0px #000000` hard edge. High-severity alert panels project an elevated `3px 3px 0px #F87171`.
- **Border Architecture:** Panels, tiles, and widgets use a crisp `1.5px` border in `#30363D`. When focused or actively selected, the border color shifts to `#E6EDF3` or `#7C3AED` with an accompanying hard drop shadow.
- **Crosshair Reticles & Technical Accents:** Corners of primary monitoring feeds feature single-pixel simulated registration brackets (`+` or `L` bracket accents) in `#484F58` to reinforce optical instrument aesthetics.

## Shapes

The design system enforces zero-radius, non-rounded geometry (`roundedness: 0`). Every panel, button, tag, table header, stream container, and input is strictly rectangular with clean 90-degree corners.

- **Corners:** `0px` radius on all interactive and passive elements.
- **Outlines:** Razor-sharp exterior boundaries. Radii are forbidden across badges, modal sheets, and tooltips.
- **Status Indicators:** Micro-dots representing feed health utilize solid square indicators (`6px` x `6px` or `8px` x `8px`) rather than rounded circles.

## Components

### Buttons
- **Primary Command:** Background `#7C3AED`, text `#E6EDF3`, border `1.5px solid #E6EDF3`, shadow `2px 2px 0px #000000`. Hover state shifts background to `#6C5CE7` with transform `translate(-1px, -1px)` and shadow `3px 3px 0px #000000`. Active state resets transform to `translate(1px, 1px)` with shadow `0px 0px 0px`.
- **Secondary / Action Tool:** Background `#1F2937`, text `#E6EDF3`, border `1.5px solid #30363D`, shadow `2px 2px 0px #000000`. Hover border becomes `#484F58`.
- **Destructive / Emergency Override:** Background `#151B23`, text `#F87171`, border `1.5px solid #F87171`, shadow `2px 2px 0px #000000`. Hover sets background to `#F87171`, text to `#0D1117`.

### Camera Feed Viewport (Tile)
- **Container:** Background `#000000`, border `1.5px solid #30363D`. Selected state changes border to `2px solid #38BDF8` with hard shadow `2px 2px 0px #000000`.
- **Feed HUD Overlay:** Floating top bar with background `rgba(13, 17, 23, 0.9)`, border-bottom `1px solid #30363D`, displaying camera title in `Space Grotesk` (11px, bold) and streaming bitrates/FPS in `JetBrains Mono` (`#5CE1E6`).
- **Corner Brackets:** 8px static line indicators positioned at corners on feed focus.

### Status Badges & Chips
- **Geometry:** Rectangular chip, `0px` border-radius, padding `2px 6px`.
- **Active / Connected:** Background `#151B23`, text `#4ADE80`, border `1px solid #4ADE80`, font `JetBrains Mono` 10px bold uppercase.
- **Warning / Activity:** Background `#151B23`, text `#FB923C`, border `1px solid #FB923C`.
- **Breach / Critical:** Background `#F87171`, text `#0D1117`, border `1px solid #F87171`, font `JetBrains Mono` 10px uppercase, tracking `0.08em`.

### Data Grids & Telemetry Tables
- **Header:** Background `#151B23`, border-bottom `2px solid #30363D`, text `#8B949E`, font `JetBrains Mono` 11px uppercase.
- **Row:** Height `32px` for dense data packing. Border-bottom `1px solid #21262D`. Alternate row striping using `#151B23` and `#1F2937`.
- **Row Hover:** Background `#21262D`, outline `1px solid #484F58`.

### Inputs & Selectors
- **Fields:** Background `#21262D`, text `#E6EDF3`, border `1.5px solid #30363D`, height `32px`, font `JetBrains Mono` 12px. Focus state triggers border `1.5px solid #7C3AED`, outline `none`, and hard shadow `2px 2px 0px #000000`.
- **Checkboxes & Radios:** Square `14px` x `14px`, border `1.5px solid #30363D`, background `#151B23`. Checked state fills `#7C3AED` with a sharp inset square or cross.

### Operational Alert Banners
- **Layout:** Full-width bar atop feeds or pinned to sidebar bottom. Border `1.5px solid #F87171`, background `#151B23`, hard drop shadow `3px 3px 0px #000000`. Left indicator strip `4px` solid `#F87171`. Content renders in `JetBrains Mono` with flashing indicator block.