# Feature: Explorer Entities

## Overview

The body of the Harness explorer: a person reviews what the application does by walking Pages,
Components, Functions, Configs and Services, and reads each one as a black box — its contract,
its size, its performance profile and the evidence that proves it — without reading source.
The screens follow the 25 approved layouts of `harness-entity-designs-v10`. Every value comes
from the built history of the repository the console was built from; nothing is illustrative.

The content is one entry component, `ExplorerContent`, given the index, the revision that is
viewed, its first parent and the address. It owns no routing and loads nothing but what its
props name; the host decides the address and supplies the data.

## Acceptance Criteria

- Pages comes first. Components and Functions use responsive card grids, with neighboring cards
  on desktop and tablet and a single column on mobile. Pages and visual Components share
  screenshot cards. Function cards show readable contract summaries and links to their recorded
  input/output tests, with no design images. Configs, Services and Shells remain tables. No collection, column or
  heading is called Sub-components, Related or Reports.
- Each component catalog card shows a usable screenshot declared to cover that component at
  the selected branch tip or commit. Prefer fresh captures; validated unchanged captures may
  be reused with their original commit visibly labelled. A missing, rejected, unvalidated,
  wrong-build or unrelated capture stays an explicit gap, never another revision's image.
  Scenario screenshots are identified as in-context evidence, not isolated component crops.
  Search, ordering, change filtering, verification tooltips and the compact icon action remain
  available. Switching branches or commits replaces the screenshots and preserves navigation.
- Search, Changed only and Order each change what a collection lists, and an empty result says
  so instead of showing nothing.
- An entity is named by its title and described by its responsibility. No file name, path,
  symbol list or raw source is in an Overview, in Relationships, in Tests, in History or in the
  default Details tab. Source ownership is rendered only when Details → Source is the open tab.
- Visual overviews show their screenshot or commit comparison first, followed by one Performance
  profile card containing size, complexity and performance measurements. Standalone Size cards are
  omitted in both overview and details. Contract, Used In and Uses appear only in their dedicated tabs, never embedded
  in any overview. The Contract tab shows API fields and category-specific contract facts only; verification states appear only in dedicated States/Tests/evidence views, never as Contract rows. It shows each field’s data type, description and examples. Declared examples remain distinct from illustrative primitive examples; opaque types without examples state the gap. Details retain the same typed contract and measurements. A metric nothing measured
  reads `Not measured`; it is never a zero. Timings taken under different profiles or targets are
  separate rows and are never joined or averaged. A declared tolerance is shown as the
  percentage that is recorded; one above the 5% policy is marked as above it, not clamped.
- Verification is binary. A green check is shown only when the verdict it is given says every
  required test, state and commit-bound capture passed; every other verdict — failed,
  incomplete, missing, stale, unknown — is a red X with its reason. No percentage and no third
  colour is rendered.
- At a selected commit a Page or visual Component overview shows the parent and the selected
  capture of the same scenario, state and viewport side by side. A side with no capture is a
  stated gap; it is never filled from the other side or from another revision.
- At the branch tip a Page or visual Component overview shows exactly one screenshot, with state
  and viewport controls, and no Before or After pane.
- A Function or Service overview shows the recorded end-to-end checks: scenario, tests, states,
  assertions and artifacts. At a selected commit it shows them for the parent and for the commit
  and says `Behavior changed` or `Behavior unchanged`; at the tip it shows the one current run.
  Where no end-to-end evidence is recorded it says so and shows a red X.
- A Config overview shows its current contract; its Used In tab lists consumers. It invents no
  screenshot and no benchmark.
- Uses lists Components, Functions, Configs and Services as separate sections; Used In lists
  consumers. Each entry opens that entity in the same revision. Components nest at any depth.
- History lists the commits that changed the entity through the viewed commit, oldest ancestry
  only, each with its date, behaviour change, simplification and performance attempt, size,
  complexity, timing per profile, reviewed budget approvals and its verdict. `View revision` and
  `Compare with previous` open the entity at that commit.
- Pages have Details and History like every other kind.
- Every link the content renders keeps the branch and the revision mode of the address it was
  given, and the content never shows data of a revision other than the one it was given.
- The layouts stay readable at desktop, tablet and mobile widths without the page scrolling
  sideways; wide tables scroll inside their own frame.
- The content computes no relation, comparison or history of its own: it renders the answers
  its host gives through one lens, so the explorer has one algorithm for each.
- Each new source file is at most 220 lines, each function at most 55, nesting at most 4.
- A verification indicator is the check or the cross alone, on every collection, card, header,
  relation, test and history row. Its status and reasons are its accessible name and a tooltip
  opened by hover, keyboard focus or a tap; missing evidence stays written where tests are read.
- A Page or Component keeps the screenshot pane also when no visual scenario names it: each side
  is a stated gap, and it never turns into the end-to-end view of a Function.
- The reasons a commit recorded for an entity are shown at the length of one reason under the
  shared writing limits (behaviour 30 words and 200 characters, each attempt 20 and 140), on the
  History row, the selected change and the Overview. An attempt several functions share is said
  once. A summary that leaves something out offers every original, as written and with each
  function's outcome, in a disclosure a keyboard can open; no stored reason is rewritten.
- An entity the shown commit removed is labelled as removed and its contract as the last one its
  parent held; scenarios and states the commit no longer declares are listed as gone.
- Recorded end-to-end results are read when the entity opens and shown on both sides without a
  control to press; nothing is called unchanged before it was read, and a failed read says so.
- Each screen has an entry of its own that a route page mounts, and an entry imports only what
  its screen draws: page cards or a table for a collection; screenshots, end-to-end results or a
  configuration for an entity; details; history. No entry reaches the content that shows every
  screen, which only picks an entry for a host without route pages. A missing registry or entity,
  the tabs of an address and every approved layout stay as they are.
- A recorded note that names a file is shown without it outside Details Source, and what a page
  or a component draws is not called by the name of its file.

## Future Enhancements

- Overlay mode for paired screenshots once two captures can be registered pixel for pixel.
- A recorded trace viewer for end-to-end runs when verification stores step traces.
