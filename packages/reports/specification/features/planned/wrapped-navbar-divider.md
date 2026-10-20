# Divider above wrapped revision controls

Status: implemented

When the branch and commit controls move below the navbar, a thin divider should
separate them from the categories. The shared row remains compact and the divider
spans the navbar. Desktop layouts that keep everything in one row need no new divider.

The existing shell scenario measures wrapping, compactness and field readability,
but does not assert separation between the navigation and revision rows. Extend its
current-state checkpoint at desktop, tablet and phone widths; capture before asserting.

## Verification

The test-only checkpoint `fe3db6ef` fails at tablet and phone widths; the separate fix
`285632b1` passes the same unchanged checks at all three widths. Recorded proof:
red `9784d01e`, green `19e87cd4`.

All 76 shell browser cases and the full Reports package check pass. The 920px live
preview was inspected with loaded images and no console errors. Native Electron
testing and the root aggregate remain paused; no native build was launched.
