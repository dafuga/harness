# Hub screens polish

Tracker item s4mpm1, the Hub follow-up to the desktop home (`../desktop-home`, PR #231). The Hub's
signed-in screens now follow `harness info ui-design`: one main piece per screen, primary actions
in one short row above it, forms only in the shared Modal, lists in the n79x63 card style, and at
most one filled primary button.

The Hub overviews carry `<!-- @harness-view overview -->`, so `harness audit` checks them for
inline forms and extra primary buttons: Hub home (`HubHome.svelte`, `HubHomeCards.svelte`),
Shared projects (`routes/projects/+page.svelte`), Members (`MembersPanel.svelte` and its route),
Devices and the Project overview page. Marking them found three inline forms, all fixed below.

The list card style is shared in `packages/hub/src/lib/styles/hub-list.css` (`.hub-list`,
`.hub-list-head`, `.hub-list-row`, `.hub-list-empty`, `.hub-actions`).

## Shared projects (`/projects`)

1. **Primary action:** one **New project** button above the list. It opens the New project form
   (repository, name, or Connect GitHub when GitHub is not connected) in the shared Modal. The
   form was inline below the list.
2. **Main piece:** the **Your projects** card. Owned projects come first, then shared ones. Each
   row is the project name and repository (opens the project) with the role and, for owners, a
   quiet Members link on the right. The quiet **Project overview** link sits in the card header.
   Loading, not-set-up and read errors are the card's empty-state line, so the card never hides.
3. **Quiet status:** the GitHub connected or failed line sits below the card. The owner's live
   tracker board follows, unchanged.

## Members (`/projects/<id>/members`)

An owner gets one **Invite someone** button above the **People** card; the invitation form and its
link and code open in a dialog. People are rows (name and email left, role right) instead of a
table. The card header has a quiet All projects link. Non-owners see the same card and the line
that only an owner invites.

## Devices (`/devices`)

The devices are rows in one **Signed-in devices** card, each with a 44px Remove button that
asks to confirm in place. Times read "Nov 23, 2026, 12:00 PM" instead of seconds. Load and
removal errors are the card's last line.

## Hub home (`/`)

The inline composer at the foot of the Agents card was a form on the overview. It is now a
**Message an agent** button that opens the Agents dialog on the chat with whoever needs you
(the composer's old default recipient); the dialog holds the composer, quick replies and the
Back to agents list. On a phone, where the rows hide their Message buttons, this button is the
card's chat entry. Nothing else on the home changed.

## Not changed

- About (`/about`) is the public landing page, not an overview, and was left as is.
- The Project overview page (`/tracker-overview`) is marked as an overview; its board is the
  shared `ProjectOverview` component, owned elsewhere, and looks the same.
- The signed-out sign-in screens and LoginPanel belong to w1yjzn and were not touched.

Nothing was removed: every form is one click away in a dialog.

## Captures

Captured from the real Hub renderer (Vite dev server) with the synthetic E2E fixtures
(`hub-home-fixture`, `hosted-fixture`, `tracker-overview-fixture`) in the dark scheme at phone
390×844 (2×), tablet 834×1112 and laptop 1440×900. No real account, device or project appears.
Each screen is a full-page capture; each dialog is a viewport capture.

| Screen           | Before                                             | After                                                                                                                             |
| ---------------- | -------------------------------------------------- | --------------------------------------------------------------------------------------------------------------------------------- |
| Shared projects  | [laptop](screens/before--projects--laptop.png)     | [laptop](screens/after--projects--laptop.png)                                                                                     |
| No projects yet  | [phone](screens/before--projects-empty--phone.png) | [phone](screens/after--projects-empty--phone.png)                                                                                 |
| New project      | inline form below the list                         | [dialog](screens/after--projects-new-project--laptop.png), [connect GitHub](screens/after--projects-empty-new-project--phone.png) |
| Members          | [laptop](screens/before--members--laptop.png)      | [laptop](screens/after--members--laptop.png)                                                                                      |
| Invite someone   | inline form below the table                        | [dialog](screens/after--members-invite--tablet.png), [link and code](screens/after--members-invite-created--phone.png)            |
| Devices          | [phone](screens/before--devices--phone.png)        | [phone](screens/after--devices--phone.png), [confirm](screens/after--devices-confirm--phone.png)                                  |
| Hub home         | [laptop](screens/before--home--laptop.png)         | [laptop](screens/after--home--laptop.png)                                                                                         |
| Message an agent | inline composer in the Agents card                 | [chat dialog](screens/after--home-message--phone.png)                                                                             |

Every screen and dialog has phone, tablet and laptop captures in `screens/`
(`<before|after>--<screen>--<size>.png`).
