# Harness app home and sign-in

Tracker items 9b6a6a (home) and 01a9xv (design patterns). Daniel, 23 Nov: one main UI piece per
page. The app opens on Sign in with Google (auth is w1yjzn), then lands on the home.

The rules these screens follow are `harness info ui-design`
(`src/templates/development-tooling/uiDesignGuidance.ts`), which also appear in every
generated AGENTS.md and Harness skill.

## Home (implemented: `packages/desktop/src/components/projects-sessions/ProjectGate.svelte`)

1. **Primary actions:** one row of buttons. Open project is the only primary button; New project
   is secondary and opens the New project form in a dialog. The form is never inline.
2. **Main piece:** the Recent projects card, in the n79x63 row style: a title with the quiet
   Project Overview link, one row per project, and an empty-state line when there are none.
3. **Quiet status:** one muted line saying a phone connects by signing in with the same Google
   account. Its small Phone access button opens today's pairing settings in a dialog until
   w1yjzn replaces pairing. Below it, the compact shared projects connection, which the sign-in
   gate will replace.

Nothing was removed: pairing, shared projects and the overview are each one click away, and
the workspace status bar still offers phone access and shared projects.

| Before                                | After                                                         |
| ------------------------------------- | ------------------------------------------------------------- |
| [laptop](screens/before--laptop.png)  | [laptop](screens/home--default--laptop.png)                   |
| [tablet](screens/before--tablet.png)  | [tablet](screens/home--default--tablet.png)                   |
| [phone](screens/before--phone.png)    | [phone](screens/home--default--phone.png)                     |
| New project form inline in the page   | [New project dialog](screens/home--new-project--laptop.png)   |
| Phone access panel inline in the page | [Phone access dialog](screens/home--phone-access--laptop.png) |

Every dialog also has tablet and phone captures in `screens/`. The home screens are captured
from the real renderer with the synthetic E2E fixtures (`ui-remote-host-fixture`); no real
account, device or project appears.

## Sign in with Google (design only: `mockup/sign-in.html`)

One main piece: the brand header, one primary **Sign in with Google** button and one muted line.
Nothing else is usable until sign-in succeeds; success lands on the home.

- `default`: the button and "Opens Google in your browser. Use the same account on your phone
  and computer."
- `waiting`: the button is disabled and reads "Waiting for Google…", the line reads "Finish
  signing in in your browser.", and a quiet Cancel button appears.
- `error`: an error line under the note; the button stays available to try again.

The button glyph is a placeholder. The implementation should use Google's official sign-in
button artwork. Render the captures with `node specification/designs/desktop-home/render.mjs`
(`screens/sign-in--<state>--<size>.png`).
