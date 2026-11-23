# Full design pass: the screens the first passes skipped

Tracker item a6fdvd (Daniel, 23 Nov). It follows `../desktop-home` (#231), `../desktop-screens`
(#234) and `../hub-screens` (#233, #239) and covers every screen they left out: the desktop entity
view, the project agent, the top-bar dialogs and pickers, Game Views, the Hub's public, invitation,
device and workspace pages, and the iPhone app (the Capacitor build of `packages/desktop`).
Sign-in screens belong to w1yjzn and are not part of this record.

Each fix below is one unit (`U1`…`U14`) and one tracker task under a6fdvd. A worker implements it
with the Harness scripts, adds the rendered-behaviour test it names, and records `after--` captures
beside the `before--` ones here. Opus reviews each PR against this page before it merges.

## Captures

`screens/before--<screen>--<size>.png`, taken from the real renderers with the synthetic E2E
fixtures (`agent-settings-fixture`, `remotePhoneFixture`, `hosted-fixture`,
`tracker-overview-fixture`) in the dark scheme. Sizes: phone 390×844 (2×), tablet 834×1112, laptop
1440×900; the iPhone app also at 320×640 (`small`). No real account, device or project appears.

| Area          | Screens                                                                                    |
| ------------- | ------------------------------------------------------------------------------------------ |
| Entity view   | `entity-page`, `entity-component`, `entity-designs`, `entity-history`                      |
| Project agent | `agent-panel`                                                                              |
| Dialogs       | `dialog-search`, `dialog-filters`, `dialog-branch`, `dialog-commit`, `dialog-workbench`    |
| Game Views    | `game-checkpoints`, `game-preview`, `game-mechanics`, `game-settings`                      |
| Hub           | `hub-about`, `hub-invite`, `hub-native`, `hub-workspace`, `hub-tracker-overview`           |
| iPhone app    | `ios-start`, `ios-pending`, `ios-connected`, `ios-revoked`, `ios-offline`, `ios-workspace` |

## Defects seen in the captures

1. The floating **Work with agent** button covers what is under it: the conversation's Send button
   (`entity-page--laptop`), the **Approve v002** note (`entity-designs--laptop`) and card content
   on a phone (`entity-page--phone`, `agent-panel--phone`).
2. "No verification recorded" is a red ✕ on every card and entity header: an absence reads as a
   failure.
3. The Branch, Commit and Project pickers are native `<select size>` list boxes with the system's
   light-blue highlight and a double focus ring (`dialog-branch`, `dialog-commit`,
   `dialog-workbench`). Branch is a free-text field.
4. The iPhone workspace footer shows **Disconnect** twice and calls a remote project "Local
   project" (`ios-workspace--phone`).
5. Game Views opens its settings form inline above the graph (`game-settings`), with **New level**
   inside the settings form.
6. The two composers order their modes differently (agent: Plan, Ask, Change, Comment;
   conversation: Comment, Plan, Change) and the agent's field draws a gold and a blue ring at once.

## Units

### U1 Verification chip (shared)

`packages/reports/src/components/shared-primitives/status/Status.svelte`. A missing verification is
a muted outlined chip **Not verified** (`--hx-color-text-muted`, no icon). Red with ✕ stays for a
failed verification only; green check for passed. Applies to the catalog card and entity header.
Test: a card with no verification shows the text "Not verified" and no element painted in the
danger colour (painted-colour helper, not literals).

### U2 Entity header and sections

`packages/desktop/src/components/explorer-ui/entity-view/EntityView.svelte`.

- The breadcrumb `pages › Alpha activity` becomes a quiet back link **‹ Pages** (44px tall), like
  the catalog's count line replaced its breadcrumb in #234.
- Kind and Plan chips stay; the verification chip is U1's.
- Phone (≤560px): the section tabs are one horizontally scrolling row (no wrap to a second line),
  and the **Conversation** button sits at the end of that row as an icon button with the label
  "Conversation", instead of a full-width button above the tabs.
- Overview: "Recorded runtime evidence" with nothing recorded is one empty-state line in the card
  ("This page is planned and not implemented: nothing is recorded for it."), not a 240px box.
  "Size & performance" gets the same title-to-content gap as the other cards.
- Designs tab: of the `Desktop` and `Default` toggles only the chosen one is gold; the other is a
  secondary button.

Test: at 390px the tab row has one line box and no horizontal page overflow; the back link is
≥44px and goes to the category; an empty evidence card is ≤120px tall.

### U3 Floating agent button never covers content

`packages/desktop/src/components/agents-providers/ProjectAgent.svelte` and the workspace shell.

- While the design conversation or the agent panel is open, the floating button is hidden (the
  panel has its own close).
- `main` reserves bottom padding equal to the button's height plus 16px, so the last card and the
  footer never sit under it.

Test (rendered geometry): with the conversation open at 1440 and 390, the button's box does not
intersect the Send button, the **Approve** button or its note; scrolled to the end, it does not
intersect the last card.

### U4 One composer

`packages/desktop/src/components/shared-primitives/Composer.svelte` and its callers
(`ProjectAgent.svelte`, the design conversation).

- One mode order everywhere: **Comment · Ask · Plan · Change** (only the modes a caller allows,
  in that order). The default stays each caller's current default.
- One focus ring: the field's own ring only; the gold frame around the composer goes.
- Agent panel header: the title **Project chat** and the close button; the slogan "Ask a
  question, plan a design, or request a code change." moves to the field's placeholder hint for
  the empty chat. On a phone the panel opens as a bottom sheet over a scrim (the shared Modal's
  sheet variant), so it no longer floats over a card.

Test: both composers list their modes in the canonical order; the focused field has one outline;
on a 390px screen the open panel has a scrim and the page behind is inert.

### U5 Revision and project pickers

`packages/desktop/src/components/shared-primitives/RevisionPicker.svelte`,
`packages/desktop/src/components/projects-sessions/project-switcher/ProjectSwitcher.svelte`.

- Replace the native list boxes with the n79x63 list-row style inside the existing popover: rows
  ≥44px, name left, muted metadata right (commit: short hash · relative date; branch: tip date;
  project: "On this device" / "Shared" as group titles), a check on the current row, arrow keys
  and Enter to choose, Escape to close.
- Branch lists the known branches (the same source the branch validation already reads) with a
  filter field at the top when there are more than 7; typing a name that is not listed still
  offers **View branch "<name>"** as the last row, so nothing the field allowed is lost.
- On a phone the popover opens as the shared Modal sheet.

Test: no `select[size]` remains in either component; each row is ≥44px; keyboard choose works;
at 390px the sheet fits with no overflow.

### U6 Filters dialog

`packages/desktop/src/components/explorer-ui/CatalogView.svelte` (filters dialog). **Changed
only** becomes a 44px switch row (label left, switch right) like the settings rows of #234.
**Done** is the one primary button; **Reset filters** stays secondary. Test: the switch row is
≥44px and toggles by clicking its label.

### U7 Catalog card preview

`packages/desktop/src/components/explorer-ui/EntityCard.svelte`. A card with no screenshot shows a
120px muted placeholder line "No screenshot recorded" instead of a 360px empty frame; cards with a
screenshot keep the 16:10 frame. Test: a card without a screenshot is at most 260px tall at 1440.

### U8 Game Views

`packages/desktop/src/routes/game/+page.svelte`, `packages/desktop/src/components/game-authoring/`
(`GameViewFields.svelte`, `GameWorkspace.svelte`, `game-preview/`).

- Header: the title and one muted line ("Demo: an in-memory example. Nothing here is saved.");
  the separate **Demo** chip goes.
- One action row: view select, the Preview / Checkpoints / Mechanics segmented control, then
  **New view** (secondary) and a **View settings** icon button at the end.
- **View settings** opens the shared Modal with the title, dimension and art direction fields;
  **New level** leaves the settings form and becomes **New view** in the action row.
- Preview on a phone: the movement controls are one row (`←`, `→`, Reset) and the disabled
  Garden / Vault jumps say why in one muted line; the live AI video model and **Start AI video**
  move behind a **Live AI video…** button that opens a dialog with the price and the not
  configured line.

Test: Game Views is marked `<!-- @harness-view overview -->` and passes `harness audit` (no inline
form outside a dialog, one primary); the settings dialog fits at 390px.

### U9 iPhone home: connect gate and quiet connection status

`packages/desktop/src/components/networking-security/remote-phone-panel/RemotePhonePanel.svelte`,
`packages/desktop/src/components/projects-sessions/ProjectGate.svelte` (Capacitor branch).

- Not connected is a gate: logo (64px), **Connect to computer**, the one-line instruction, the
  phone name field and **Scan QR code**. The empty Recent projects card is not shown before a
  connection; the slogan goes. Sign out is a quiet link under the gate.
- Pending, revoked and offline keep their one status line and one action in the same gate layout.
- Connected: the Recent projects card is the main piece (rows with a chevron, ≥44px). Under it,
  one quiet status chip **Connected to Synthetic Mac** opens a **Connection** dialog with: computer
  awake line, grants line, this phone's name, the key, **Disconnect** and **Sign out**.

Test: at 320 and 390 the connected screen shows no Disconnect or key outside the dialog; the
dialog holds both; nothing overflows.

### U10 iPhone workspace footer

`packages/desktop/src/components/networking-security/HostedConnection.svelte` and the workspace
footer. A remote (paired) workspace shows one footer line: "Synthetic Mac · Ada iPhone" with one
**Disconnect** (or the same Connection dialog as U9). "Local project" is never shown for a remote
project. Test: on `ios-workspace` exactly one Disconnect control exists and no "Local project" text.

### U11 Phone category bar

`packages/desktop/src/components/projects-sessions/nav-bar/nav-bar/navBar.css` (phone block). At
≤560px the eight categories are one horizontally scrolling row of icon+label tabs (the active one
scrolled into view) instead of two rows. This lowers the header; it must still pass
`ui-search-fit` (320/390/560) and the 214px header guard (`ui-workspace`). Run both before and
after.

### U12 Hub phone header

`packages/hub/src/components/shared-primitives/HubFrame.svelte`. At ≤560px the account links
(name, Projects, Devices, Download, Members, Sign out) wrap under the logo. Show the logo and the
page title, and one **Menu** button that opens the shared Modal with those links as rows. Laptop
and tablet unchanged. Test: at 390px the header is one row ≤64px tall and every link is reachable
in the menu.

### U13 Hub gate pages: invitation and device approval

`packages/hub/src/routes/invite/[projectId]/[invitationId]/+page.svelte`,
`packages/hub/src/routes/native/[handoffId]/+page.svelte`.

- One heading: the page `h1` stays ("Join a shared project", "Connect a Harness device"); the
  card's repeated `h2` goes.
- One narrow centred card (max 480px), like a gate: one muted line (who is signed in), the code
  field, the primary button.
- The code field is monospace with the code's format as placeholder (`ABCD-EFGH`) and
  `autocomplete="one-time-code"`.
- Device approval: the permission paragraph becomes one muted line ("It can open every shared
  project you can open, as ada@…") with a **What this allows** disclosure holding the role
  details and the never-type-a-code-someone-sent-you warning, which stays visible as the line
  above the button.

Test: one `h1` and no `h2` in main; the card is ≤480px wide at 1440; the field and button are ≥44px.

### U14 Hub about page primary

`packages/hub/src/routes/(public-site)/about/+page.svelte`. The hero's filled **Mac app coming
soon** button does nothing yet looks enabled, while the same action at the foot looks disabled.
Hero: **Log in** is the one primary button; "Mac app coming soon" is a muted chip beside it, the
same as the iPhone chip in the download section. Test: one filled primary in the hero, and no
enabled button without an action.

## Rule additions (U0)

`src/templates/development-tooling/uiDesignGuidance.ts` (and the AGENTS.md and Harness skill text generated from it) gains:

- A floating button never covers content or another control; hide it while a panel it opens, or
  any side panel, is open, and pad the content by its height.
- Absence is not failure: "not recorded" or "not measured" is muted text; red is for a failed
  check only.
- Pickers use the shared list rows, never a native list box (`select[size]`) or the system
  highlight.
- One composer: modes always read Comment · Ask · Plan · Change, whichever subset a screen offers.
- A gate page has one heading.

`harness audit` can check the list-box rule (`select[size]` or `multiple` outside a form dialog
in a Svelte component); the others are review rules.
