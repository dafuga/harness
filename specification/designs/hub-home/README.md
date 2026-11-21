# Hub home redesign: design proposal

Designs only. Nothing here changes app code. This proposes a new root summary page for the
Harness Hub with five sections. Each section shows a short preview and a **See all** button that
opens a modal. It revisits the approved Project Overview cards page (tracker n79x63, xm64q4): that
page moves, unchanged, into the Work in progress modal.

Every name, task, hash and time in these screens is a synthetic example.

## How the mockups are made

`mockup/index.html` is a static page. It draws every screen from synthetic data
(`mockup/data*.js`) and links the **real** Harness stylesheets straight from the repo:

- `packages/reports/src/lib/styles/app-tokens.css`: the shared token catalog
- `packages/reports/src/lib/styles/project-overview*.css`: the approved n79x63 cards, chips,
  bands, rows, ETA chips and state pills
- `packages/hub/src/lib/styles/home-scheme.css`: the Hub homepage's light scheme

The mockup's own CSS (`mockup/*.css`) only lays things out. It uses `--hx-*` tokens and no literal
colours, so it can carry over to Svelte components as written.

Render all screens (headless Chromium; no window opens):

```sh
bun install
node specification/designs/hub-home/render.mjs            # all 130 screens
HH_ONLY=agents node specification/designs/hub-home/render.mjs   # one screen
```

To view a single screen in a browser, open
`mockup/index.html?screen=<screen>&state=<state>`. The colour scheme follows the OS setting.

## Screens

`screens/<size>/<screen>--<state>--<scheme>[--full].png`

- **Sizes:** phone 390 (2x), tablet 834, laptop 1440, wide 1920.
- **Screens:** `root`, `agents`, `agent-chat` (phone only: the chat step), `plans`,
  `scheduled`, `projects`, `wip` (soonest first), `wip-projects` (by project: the current
  overview).
- **States:** `default`, `busy`, `empty`, `loading`.
- **Schemes:** `dark` and `light`. The Hub homepage already supports both, so the new home keeps
  both.

| What                    | Sizes         | Schemes    | States                        |
| ----------------------- | ------------- | ---------- | ----------------------------- |
| Root page (full length) | all four      | dark+light | default, busy, empty, loading |
| Each modal, first view  | all four      | dark+light | default                       |
| Each modal, full length | phone, laptop | dark       | default                       |
| Each modal              | phone, laptop | dark       | busy, empty, loading          |
| Agent chat step         | phone         | dark+light | default                       |

Start with:
[laptop root](screens/laptop/root--default--dark.png) ·
[phone root, light](screens/phone/root--default--light.png) ·
[wide root, busy](screens/wide/root--busy--dark.png) ·
[Agents](screens/laptop/agents--default--dark.png) ·
[Work in progress by project](screens/laptop/wip-projects--default--dark--full.png) ·
[Projects](screens/laptop/projects--default--light.png) ·
[phone chat](screens/phone/agent-chat--default--light.png) ·
[root loading](screens/laptop/root--loading--dark.png) ·
[root empty](screens/laptop/root--empty--light.png)

## Design choices

1. **The sections are n79x63 cards.** Each section is a `.po-card`. Preview rows are `.po-item`
   rows with the same title, meta line and trailing chip, and states use the same pills
   (diamond = needs you, dot = active, square = blocked, dashed = quiet). The home reads as part
   of the overview, not as a new visual system.
2. **The headline answers "what needs me?"** For example: "3 agents working, 1 needs you". It is
   followed by a totals line and the computer pills from the overview.
3. **Layout by width.**
   - Laptop: three columns, with Agents spanning two because it holds the chat entry.
   - Wide: four columns, capped at 1800px. Projects and Work in progress each span two, and the
     wide Projects card lists twice as many projects.
   - Tablet: two columns, with Agents across the top.
   - Phone: one column in the order given in the brief.
     The DOM order is always Agents, Plans, Scheduled, Projects, Work in progress.
4. **Previews are short and end in a count.** There are four rows on laptop and two on phone,
   using the overview's own `data-extra` phone rule. **See all** names the total ("All 15
   agents"), so the busy state never grows the page.
5. **Agents is the chat entry point.** Each agent row has a state pill and a **Message** button.
   The card ends in a composer whose recipient defaults to whoever needs you. The Agents modal is
   a list grouped by Needs you / Working / Idle / Offline next to a chat pane. Quick-reply buttons
   (for example "Approve Sat 09:00") appear when an agent asks a question. On a phone, the list
   and the chat are two steps of one sheet, with a back button.
6. **Plans** show a progress bar (steps done / total) on the root page. The modal has status
   chips (Draft, In review, Approved, In progress, Done) and a card per plan with its next three
   steps.
7. **Scheduled** is an agenda in time order, grouped by day. Each run names its agent and
   computer. Routines show a repeat mark, and paused runs are dimmed and labelled "Paused".
8. **Projects** is the current Harness app in one place. On the left is the project list with
   its last change. On the right is the selected project's apps (with page and component counts),
   pages, components (as tags with "+N more") and change history (hash, message, agent, time).
9. **Work in progress** leads with the summary line ("12 tasks across 6 projects"). Rows are
   ordered soonest to finish first, and overdue items come first with the overview's red ETA
   chip. The modal has two tabs: **Soonest first** (default) and **By project**, which is the
   current Project Overview with its chips, bands and cards, unchanged.
10. **Modals reuse the overview's dialog frame** (`hub.css` `.viewer-dialog`): a strong border, a
    16px radius, and a blurred strong scrim. They are 1240px wide on laptop, 1500px on wide and a
    full-screen sheet on phone. The header (title, summary line, optional primary action, 44px
    close) stays fixed and the body scrolls.
11. **States.**
    - Loading keeps every card in place with skeleton rows the height of real rows, so nothing
      shifts when data arrives.
    - Empty keeps the card and gives one next step ("Start a plan", "Schedule a task").
    - Busy shows an overloaded computer, two agents needing you, a two-line clamped long title and
      "+N" totals.
12. **Light scheme.** It uses the Hub homepage pattern: colours mixed from catalog tokens and
    reassigned on `.home-page`. Three additions were needed and are in `mockup/base.css` and
    `mockup/sections.css`:
    - a darker info colour (the dark-scheme info blue is too faint on paper)
    - a light strong scrim
    - gold _text_ (the needs-you pill, the kicker, commit hashes) drawn from `--home-accent`, not
      `--hx-color-primary`

## Open questions for Daniel

1. **Root URL.** The Hub root (`/`) is the public marketing homepage today. Should the new home
   replace it for signed-in users (and keep marketing for signed-out visitors), or live at
   `/home`?
2. **Where the chat goes.** The composer sends a message to an agent's session. Should it go
   through the tracker (a note or answer on that agent's current item), or straight to the
   session through the Remote Control relay? This decides what "replies reach the session"
   means.
3. **Plans source.** There is no plans store yet. Should Plans come from tracker items of a "plan"
   kind, from `specification/loops`, or from a new store?
4. **Scheduled source.** Should Scheduled read tracker due items, Claude scheduled routines, the
   box's cron, or all three merged?
5. **Light mode beyond the homepage.** Today only the public homepage has light mode, and the
   overview and project pages are dark-only. Should the new home follow the OS scheme, as these
   mockups do, or stay dark like the rest of the signed-in app?
6. **Done and quiet projects.** The overview shows Quiet and Done bands. The Work in progress
   modal keeps only active work. Should finished projects stay reachable from it, for example
   with an "Include done" chip?

## Files

- `mockup/`: page source (HTML, CSS, synthetic data)
- `render.mjs`: Playwright renderer
- `screens/`: rendered PNGs, stored with Git LFS (`.gitattributes`)
