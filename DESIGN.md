---
name: Finance Tracker
description: Private personal finance PWA in the Athens Metro wayfinding world
colors:
  rail-navy: "oklch(0.285 0.078 263)"
  rail-navy-raised: "oklch(0.335 0.085 263)"
  rail-ink: "oklch(0.985 0.004 250)"
  rail-ink-muted: "oklch(0.84 0.035 258)"
  tile-ground: "oklch(0.968 0.006 250)"
  panel: "oklch(1 0 0)"
  panel-sunk: "oklch(0.948 0.009 252)"
  ink: "oklch(0.23 0.035 262)"
  ink-secondary: "oklch(0.42 0.03 260)"
  ink-tertiary: "oklch(0.5 0.025 258)"
  rule: "oklch(0.87 0.012 255)"
  rule-strong: "oklch(0.76 0.018 256)"
  action-blue: "oklch(0.5 0.165 257)"
  action-blue-hover: "oklch(0.45 0.165 257)"
  action-blue-soft: "oklch(0.93 0.035 255)"
  line-green-income: "oklch(0.5 0.13 152)"
  line-red-spending: "oklch(0.52 0.19 28)"
  line-ochre-goal: "oklch(0.47 0.1 70)"
  line-violet-tax: "oklch(0.48 0.15 302)"
  warning-amber: "oklch(0.5 0.11 65)"
  danger-red: "oklch(0.5 0.2 27)"
  rail-navy-dark: "oklch(0.235 0.07 263)"
  tile-ground-dark: "oklch(0.175 0.02 262)"
  panel-dark: "oklch(0.215 0.024 262)"
  ink-dark: "oklch(0.955 0.008 250)"
  action-blue-dark: "oklch(0.72 0.13 252)"
typography:
  headline:
    fontFamily: "'Source Sans 3 Variable', 'Segoe UI', system-ui, sans-serif"
    fontSize: "2.25rem"
    fontWeight: 600
    lineHeight: "2.5rem"
    letterSpacing: "-0.015em"
  figure:
    fontFamily: "'Source Sans 3 Variable', 'Segoe UI', system-ui, sans-serif"
    fontSize: "2.25rem"
    fontWeight: 600
    lineHeight: "2.5rem"
    fontFeature: "'tnum' 1, 'lnum' 1"
  title:
    fontFamily: "'Source Sans 3 Variable', 'Segoe UI', system-ui, sans-serif"
    fontSize: "1.125rem"
    fontWeight: 600
    lineHeight: "1.625rem"
  body:
    fontFamily: "'Source Sans 3 Variable', 'Segoe UI', system-ui, sans-serif"
    fontSize: "1rem"
    fontWeight: 400
    lineHeight: "1.5rem"
  label:
    fontFamily: "'Source Sans 3 Variable', 'Segoe UI', system-ui, sans-serif"
    fontSize: "0.875rem"
    fontWeight: 500
    lineHeight: "1.25rem"
  nav:
    fontFamily: "'Source Sans 3 Variable', 'Segoe UI', system-ui, sans-serif"
    fontSize: "0.9375rem"
    fontWeight: 400
    lineHeight: "1.25rem"
  micro:
    fontFamily: "'Source Sans 3 Variable', 'Segoe UI', system-ui, sans-serif"
    fontSize: "0.6875rem"
    fontWeight: 500
    lineHeight: "1rem"
    fontFeature: "'tnum' 1"
rounded:
  sm: "4px"
  md: "6px"
  lg: "10px"
  xl: "14px"
  full: "9999px"
spacing:
  hairline: "1px"
  xs: "4px"
  sm: "8px"
  md: "16px"
  lg: "24px"
  xl: "40px"
components:
  button-primary:
    backgroundColor: "{colors.action-blue}"
    textColor: "{colors.panel}"
    rounded: "{rounded.md}"
    padding: "0 16px"
    height: "44px"
  button-primary-hover:
    backgroundColor: "{colors.action-blue-hover}"
  button-secondary:
    backgroundColor: "{colors.panel}"
    textColor: "{colors.ink}"
    rounded: "{rounded.md}"
    padding: "0 16px"
    height: "44px"
  button-danger:
    backgroundColor: "transparent"
    textColor: "{colors.danger-red}"
    rounded: "{rounded.md}"
    height: "44px"
  input:
    backgroundColor: "{colors.panel}"
    textColor: "{colors.ink}"
    rounded: "{rounded.md}"
    padding: "0 12px"
    height: "44px"
  nav-rail:
    backgroundColor: "{colors.rail-navy}"
    textColor: "{colors.rail-ink-muted}"
    width: "256px"
  nav-rail-active:
    backgroundColor: "{colors.rail-navy-raised}"
    textColor: "{colors.rail-ink}"
  bottom-bar:
    backgroundColor: "{colors.rail-navy}"
    textColor: "{colors.rail-ink-muted}"
    height: "64px"
---

# Design System: Finance Tracker

## Overview

**Creative North Star: "The Line of the Month"**

Finance Tracker borrows the Athens Metro's wayfinding: a deep navy rail that tells you where you are, a calm tiled
ground, and coloured lines that carry meaning. Money moves on lines. Every dated item of the month is a station on its
day, hollow while it is only expected and filled once it is received or paid, so the most important distinction in
the product (expected is not received) is drawn, not just written.

The surface is an operating tool used in the evening on a phone and on the 1st of the month at a desk. Density is
moderate, hierarchy comes from the size and weight of one typeface, and colour is never decoration: the rail owns the
shell, the line colours own the data, and one action blue owns what can be pressed.

**Key Characteristics:**
- Navy rail shell (desktop sidebar, phone bottom bar) on a cool tile ground with white panels.
- Stations: hollow = expected, filled = done, pill with a count = an interchange day.
- One family (Source Sans 3), tabular figures for every amount, true minus sign.
- One-pixel rules separate sections; no cards, no shadows on content.
- Light and dark are both first-class; the device decides unless the user picks.

## Colors

A restrained neutral system tinted toward the rail's navy, plus line colours that each carry one meaning.

### Primary
- **Rail Navy** (oklch(0.285 0.078 263); dark theme oklch(0.235 0.07 263)): the shell itself, the desktop sidebar and
  the phone bottom bar, the signed-out header. It owns whole regions, never accents.
- **Action Blue** (oklch(0.5 0.165 257); dark theme oklch(0.72 0.13 252)): primary buttons, current selection, focus
  ring, wizard progress. The only colour that means "you can press this".

### Secondary
- **Line Green** (oklch(0.5 0.13 152)): income, received money.
- **Line Red** (oklch(0.52 0.19 28)): spending, paid money.
- **Line Ochre** (oklch(0.47 0.1 70), fill oklch(0.72 0.14 78)): savings goals.
- **Line Violet** (oklch(0.48 0.15 302)): the tax reserve.

### Neutral
- **Tile Ground** (oklch(0.968 0.006 250); dark oklch(0.175 0.02 262)): page background.
- **Panel** (white; dark oklch(0.215 0.024 262)): inputs, sheets, raised surfaces.
- **Ink** (oklch(0.23 0.035 262); dark oklch(0.955 0.008 250)) with **Ink Secondary** and **Ink Tertiary** for hints.
- **Rule** (oklch(0.87 0.012 255)) and **Rule Strong** for control borders.

### Named Rules
**The One Meaning Rule.** Each line colour means one thing everywhere (green income, red spending, ochre goals,
violet tax). Warning amber and danger red always come with an icon and words.

**The Zero Is Neutral Rule.** An amount of zero is shown in ink, not in its line colour.

## Typography

**Body Font:** Source Sans 3 Variable (self-hosted, Greek subset), falling back to Segoe UI and the system sans.

**Character:** A plain, narrow workhorse that keeps long Greek labels on one line and sets money in even columns.

### Hierarchy
- **Headline** (600, 1.75rem phone / 2.25rem desktop, tracking -0.015em): page titles.
- **Figure** (600, 1.375rem phone / 2.25rem desktop, tabular): the month's in, out and left amounts.
- **Title** (600, 1.125rem): section headings under a hairline.
- **Body** (400, 1rem / 1.5rem): text and controls; prose capped near 65ch.
- **Label** (500, 0.875rem): field labels and segmented controls.
- **Nav** (400, 0.9375rem; 600 when current): desktop rail items.
- **Micro** (500, 0.6875rem, tabular): month-line day ticks and interchange counts, phone bottom-bar labels. Never for
  body text.

### Named Rules
**The Even Columns Rule.** Every amount uses tabular figures (`tnum`) and a true minus sign (U+2212); a test asserts
equal digit widths so a font change cannot break it.

**The One Family Rule.** Hierarchy comes from size and weight of one family; no display face, no monospace costume.

## Layout

Desktop: a fixed 16rem rail on the left, content up to 72rem wide with 2.5rem side padding. Phone: content with a
1rem gutter, a 64px bottom bar respecting the safe area, and a central Add slot. A page is a header (title and one
meta line) followed by sections separated by one-pixel rules, with 1.5rem of space above each section title.
Settings and forms run in one column on phones and two where pairs belong together on desktop.

## Elevation & Depth

Flat by default. Depth is tonal: panels sit on the ground by colour and one-pixel rules, not shadows. The only shadow
is the overlay shadow on sheets (`0 12px 32px -8px` navy at 28 % plus `0 2px 6px` at 12 % in light mode), because a
sheet really sits above the page.

### Named Rules
**The Flat Ground Rule.** Content never casts a shadow; only overlays do.

## Shapes

Gently rounded rectangles like enamel signs: 6px for controls, 10–14px for sheets, full circles for stations and
switches. Lines end in round caps.

## Components

### Buttons
- **Shape:** 6px corners, 44px tall (phone touch target), 16px side padding.
- **Primary:** Action Blue fill with white text; 1px press-down on active.
- **Secondary:** panel fill, strong rule border.
- **Ghost:** text only for low-emphasis actions.
- **Danger:** outlined in danger red; fills only on hover or keyboard focus, so it is never pressed by accident.

### Inputs / Fields
- **Style:** panel fill, strong rule border, 6px corners, 44px tall, label above, hint or error below.
- **Focus:** Action Blue border with a soft blue ring. **Error:** danger border and a message linked by
  `aria-describedby`.

### Navigation
- **Desktop rail:** navy, white wordmark, items in muted rail ink; the current item gets a raised navy fill and a
  white station dot on the rail's edge.
- **Phone bottom bar:** navy, icon over label, the current item bold with a short white line under it; everything
  else under "More" in a bottom sheet.

### Segmented control and switch
- **Segmented:** a sunk track; the chosen segment gets the soft blue fill, a blue hairline and semibold text.
- **Switch:** a full-width labelled row; the track fills Action Blue when on.

### Ledger rows
- Grouped by day under a one-pixel rule, day name on the left and the day's net on the right.
- Each row: station mark (hollow expected, filled done), label with category and account below, amount right-aligned in
  tabular figures; income in line green with a plus sign, expected amounts in tertiary ink. Expected rows carry a
  secondary "Received"/"Paid" button. Rows are 56px tall.

### Quick-add sheet
- Bottom sheet opened from the central round Add button (phone) or the rail's primary button (desktop). Large amount
  field with the decimal keypad, category chips (most recent first, colour dot from the chart palette), Today/Yesterday
  chips plus a date field, account, optional note, one primary Save. Offline it saves to the device queue and says so.

### Calendar
- Desktop: a Monday-first month grid with one-pixel cell rules; today is an ink disc; up to three items per day with
  station marks, then "+n". Phone: an agenda drawn as a vertical line (solid ink for days passed, rule colour ahead),
  each day a station with its items. Tapping a day opens a sheet to confirm or add.

### The Month Line (signature)
A horizontal line across the month with day ticks (1, 10, 20, last). The travelled part is solid ink, the rest a strong
rule; today is an ink tick through the line with "today" beneath, drawn under the stations so none is hidden. Stations sit on their day: hollow ring in the
item's line colour while expected, filled when done; several items on one day form an interchange pill with a count.

## Do's and Don'ts

### Do:
- **Do** draw expected versus done as hollow versus filled, with words next to it.
- **Do** keep every interactive target at least 44px tall on phones.
- **Do** separate sections with one-pixel rules and space, not boxes.
- **Do** set amounts with tabular figures and a lighter currency symbol.

### Don't:
- **Don't** use a line colour for anything but its meaning.
- **Don't** put content in cards or nested cards, or add shadows to content.
- **Don't** add eyebrow labels above headings, gradient text or decorative glass.
- **Don't** colour a zero amount.
