---
version: 1
slug: "src-app-app-layout-tsx"
primary_target: "src/app/(app)/layout.tsx"
related_targets: ["src/app/(public)"]
---

# App shell and working screens

Scope: every authenticated screen (dashboard, transactions, income, fixed costs, accounts, calendar, budgets,
goals, plan, reports, tax, investing, settings) plus setup, login and onboarding. Visitor mode: Operate.
Build path: code-led (Operate surface). Decision taken unattended from the owner's brief; the roll ran with
challengers and was judged in-thread.

Audience and job: the owner logs spending in seconds on a phone at night and reviews the month on the 1st.
Constraints: Greek first, EUR, Europe/Athens; WCAG AA; dark and light both first-class; quick-add thumb-reachable.

## Direction contract

THESIS: Money moves on lines. The month is a metro line: every income, bill, renewal and goal contribution is a
station on its date, hollow while expected, filled once received or paid. Refuses the grey card-grid dashboard
with a hero balance and neon accent.

OWN-WORLD: Athens Metro wayfinding. A deep navy rail with white type owns the shell; cool enamel-tile ground,
white panels, one-device-pixel rules, no shadows on content. Line colours do data work: green income, red
spending, blue primary action and selection, ochre goals, violet tax reserve. Source Sans 3 (Greek extension),
one variable family, tabular figures, hierarchy by size and weight only.

STORY: Open, see where the month stands against the line, add an expense in one thumb tap, confirm what arrived.

FIRST VIEWPORT: Mobile: month ledger line (in, out, left) in large tabular figures; below it the month line
strip with today's marker and the next stations; budget bars; bottom bar with four destinations and a central
Add. Desktop: navy left rail, same content in two columns, Add top-right.

FORM: Athens Metro wayfinding, 4th of 7 grounded candidates; seed: a502ca9f8c7e09b1.
Raises: from the boarding pass and gate board (declined): a changed state holds its colour until acknowledged,
and a confirmed row moves in place keeping its identity. From the dark-first console (declined): destructive
actions sit apart, outline until focused. From the centre-rail setting (declined): every rule is one device
pixel and state is a mark (hollow, filled, struck, ringed on focus). From the variable-font specimen (declined):
hierarchy from one variable face's size and weight, nothing else. From the guide map (declined): flat colour,
no gradients; colour owns whole regions (the rail), never sprinkled.

FINISH: unreviewed and undocumented is unfinished; this build ends with the finish review, the verdict, DESIGN.md, and every shipping raster carrying its provenance
