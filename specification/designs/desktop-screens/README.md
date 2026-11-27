# Harness app screens after the home

Tracker item s4mpm1 (Daniel, 23 Nov): apply `harness info ui-design` to every other desktop screen,
following the home of PR #231 (`specification/designs/desktop-home`). The Hub website has its own
record in `specification/designs/hub-screens`.

## Overview markers

| Screen                         | Source                                                                                      | Marked overview                        |
| ------------------------------ | ------------------------------------------------------------------------------------------- | -------------------------------------- |
| Home                           | `packages/desktop/src/components/projects-sessions/ProjectGate.svelte`                      | yes (#231)                             |
| Project screens (each catalog) | `packages/desktop/src/components/explorer-ui/CatalogView.svelte`                            | yes                                    |
| Project Overview               | `packages/reports/src/components/projects-sessions/project-overview/ProjectOverview.svelte` | yes                                    |
| Settings                       | `packages/desktop/src/routes/settings/+page.svelte`                                         | no: it is the settings form's own page |

`harness audit` now lets an overview keep a search field inside a `role="search"` landmark: the
field narrows the main piece, it does not ask for input. Every other field still has to open in a
dialog. The rule and its guidance line (`uiDesignGuidance.ts`, every AGENTS.md and Harness skill)
say so.

## Project screens

1. **Header:** the breadcrumb (`Alpha › Components`, which the project switcher and the active
   category already say) and the slogan "Browse components and understand your project." are gone.
   One muted line under the title says how many are listed: `1 component`, or `0 of 1 components
shown` while a search or filter narrows the list. The APIs heading reads `APIs`.
2. **Cards:** opening an entity is a quiet outlined button; the gold outline is kept for a plan
   to review, so gold marks the one thing that needs you.
3. **Top bar:** the project switcher no longer draws a stray divider at the far right of the bar.
   On a tablet the search is its icon and ends the branch row, instead of taking a row of its own.
   The phone toolbar is unchanged: putting search on the branch row overlapped the revision
   buttons at 320px, and the header must stay within 214px (`ui-search-fit`, `ui-workspace`).

## Project Overview

The approved n79x63 cards are unchanged; the screen is marked overview and passes the audit.

## Settings

One centred column like the home: a quiet back link (it says `Back to home` when settings was not
opened from a project), the title, and one card in the list style: the Agents title over a
hairline, then each setting on a row with its name on the left and its control on the right, and
its note muted beneath. On a phone the control wraps under its name.

## Designs and linked devices

The Mac and Hub use the same Designs header and canvas. Canvas selectors show the title,
artboard count and active canvas. On Mac they read the current checkout through the native
bridge, including local edits. Hub selection uses the hosted branch URL.

The linked-device dialog uses the Hub Devices row presentation. Its rows show clients connected
to this computer, with project grants, access level, connection status and Revoke. Link and
Unlink this Mac remain host controls. The Hub Devices page manages account sessions and linked
computers.

| Screen                   | Before                                                                                                                                                                     | After                                                                                                                                                                   |
| ------------------------ | -------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | ----------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| Components               | [laptop](screens/before--project-components--laptop.png), [tablet](screens/before--project-components--tablet.png), [phone](screens/before--project-components--phone.png) | [laptop](screens/after--project-components--laptop.png), [tablet](screens/after--project-components--tablet.png), [phone](screens/after--project-components--phone.png) |
| Pages                    | [laptop](screens/before--project-pages--laptop.png), [tablet](screens/before--project-pages--tablet.png), [phone](screens/before--project-pages--phone.png)                | [laptop](screens/after--project-pages--laptop.png), [tablet](screens/after--project-pages--tablet.png), [phone](screens/after--project-pages--phone.png)                |
| Settings                 | [laptop](screens/before--settings--laptop.png), [tablet](screens/before--settings--tablet.png), [phone](screens/before--settings--phone.png)                               | [laptop](screens/after--settings--laptop.png), [tablet](screens/after--settings--tablet.png), [phone](screens/after--settings--phone.png)                               |
| Project Overview (as is) | [laptop](screens/before--project-overview--laptop.png), [tablet](screens/before--project-overview--tablet.png), [phone](screens/before--project-overview--phone.png)       | unchanged                                                                                                                                                               |

Captured from the real renderer with the synthetic E2E fixtures (`agent-settings-fixture`,
`projectOverviewNativeFixture`) at phone 390×844, tablet 834×1112 and laptop 1440×900. No real
account, device or project appears. `packages/desktop/tests/e2e/ui-screen-polish.spec.ts` checks
the rendered result at those widths.
