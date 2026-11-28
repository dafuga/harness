# Hub home as a board: design proposal

Designs only. Nothing here changes app code. Tracker item ma3g7g; the build waits on ycw5dy.

The Hub home page becomes a Kanban board. A strip of overall numbers sits above it, and the
agents live in a dock in the bottom-right corner of every page. The board replaces the current
Home sections (Blocked - needs you, Agents, Quota, Scheduled, Projects): needs-you items are the
top cards of the Blocked column, agents move to the dock, quota and computers move to the strip,
and Scheduled and Projects keep their own pages in the top bar.

Every project, task, agent, number and time in these screens is made up. The repository is
public, so no live Tracker rows are used.

## Directions

Three directions, each drawn for desktop (1440 wide) and iPhone (390 wide), light and dark.

| Direction                                | What it is                                                                                                                          | Trade-off                                                                                                                        |
| ---------------------------------------- | ----------------------------------------------------------------------------------------------------------------------------------- | -------------------------------------------------------------------------------------------------------------------------------- |
| **Board with agents dock** (recommended) | Stats strip, project filter, four full-width columns, agents in a corner dock that follows you to every page.                       | Agents are one tap away rather than always listed.                                                                               |
| Agents sidebar                           | Agents, computers and quota in a permanent left sidebar, as in the reference screenshot; the headline carries the two main numbers. | The board loses a fifth of its width, so titles wrap and cards get taller. Every page needs the sidebar. iPhone needs a tab bar. |
| Project lanes                            | The same strip and dock, with one row per project and the four states as columns.                                                   | Shows the balance between projects without a filter, but the page gets long and a busy project pushes the others off screen.     |

The first is recommended because it is what was asked for (numbers on top, board below, agents
in the corner everywhere), it gives cards the most room, and it changes no other page beyond
adding the dock.

## Screens

`screens/<Name>.light.png` and `screens/<Name>.dark.png`, rendered at 2x.

| Screen               | Shows                                                                                   |
| -------------------- | --------------------------------------------------------------------------------------- |
| `BoardDesktop`       | Recommended home: strip, filter, To do / In progress / Blocked / Done, dock closed      |
| `BoardDesktopDock`   | Dock open: agents with a question first and highlighted, then working, New conversation |
| `BoardDesktopChat`   | Dock chat with an agent that has a question: choices in a grid, one composer            |
| `BoardDesktopDetail` | Card detail side panel: the question, choices with descriptions, notes                  |
| `DockOtherPage`      | The same dock on the Scheduled page                                                     |
| `BoardPhone`         | iPhone home, In progress selected                                                       |
| `BoardPhoneBlocked`  | iPhone home, Blocked selected (needs-you cards first)                                   |
| `BoardPhoneDock`     | iPhone agents sheet (full screen)                                                       |
| `BoardPhoneDetail`   | iPhone card detail sheet                                                                |
| `SidebarDesktop`     | Alternative: agents sidebar                                                             |
| `SidebarPhone`       | Alternative: agents sidebar on iPhone (Board / Agents / Status tab bar)                 |
| `LanesDesktop`       | Alternative: project lanes                                                              |
| `LanesPhone`         | Alternative: project lanes on iPhone (the two most urgent cards per project)            |

## Decisions in the recommended direction

- **Strip:** Sessions running, Needs you, Computers (Primary Mac, MacBook 2, Box: state word,
  load bar, sessions) and Quota (Claude 5 hour, Codex weekly: share left and reset time). The
  state word follows the number: 91% load reads "High load", an unreachable computer reads
  "Offline" with when it was last seen. Sessions and Needs you are buttons that filter the board.
- **Cards** are three short lines and hold no form. To do shows queue place or due time and the
  planned model and computer. In progress shows model, computer and ETA. Blocked shows one line
  of reason. Done shows the merged pull request as a link.
- **Needs-you cards** sort to the top of Blocked with the accent border and a Needs you pill.
  Their one action, Answer, opens the detail panel; the choices and any typing live there or in
  the chat, never in the card. The column header counts them ("3 need you").
- **Columns** show what fits and end with "Show N more"; Done shows this week's most recent.
- **Dock:** a pill with the asking agents' initials and "3 have questions". Open, it lists agents
  with a question first (highlighted, with the question and the wait), then working agents, and
  ends with New conversation. A row opens the chat in the same overlay. The pill sits in a bottom
  band beside the quiet "Live" line, so it never covers a card.
- **iPhone:** the strip becomes four numbers and three computer chips; the board shows one column
  at a time, picked from a four-part switch that carries the counts (swiping would also move
  between columns). The dock is a full-width bar in a bottom band and opens as a full-screen
  sheet; card detail is a sheet with the choices stacked.

## Source

`designs/hub-board/` holds the canvas: one self-contained HTML artboard per screen plus
`canvas.json`. The artboards are generated from `source/` (sample data, parts and styles) so the
thirteen screens stay consistent:

```sh
bun specification/designs/hub-board/source/build.mjs     # writes designs/hub-board
bunx prettier --write designs/hub-board
node specification/designs/hub-board/source/render.mjs   # writes screens/ (headless, no window)
```

`harness design list hub-board` checks the canvas, and `harness design render hub-board` renders
it the standard way. Colours are the shared `--hx-*` tokens in both themes; no literal colours
outside the token block.
