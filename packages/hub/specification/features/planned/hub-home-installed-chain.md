---
status: planned
---

# Hub Home is tested as the installed app runs it

Retro ecw4cy: Hub Home specs passed while web taps were refused on production. They served a
stored snapshot, listed no linked computer and answered the Hub's chat route themselves, the
opposite of the installed app, which publishes nothing.

- The shared Home browser fixture defaults to a linked computer and no stored snapshot. Its chat
  route refuses, as the real one does then. `published` is named only by the spec of the publish
  path itself.
- `hub-home-installed-chain.spec.ts` joins the built Home page, the Hub's Home and
  remote-computer routes, the relay, the Mac app's own main process and the Tracker's local API.
  It reads an ask, taps an option, answers with Other, sends a session note, opens View spec and
  answers beside it, and checks each Tracker record. The Hub must have stored nothing.
- The Mac runs as its own process. It gets no `HARNESS_` variable; what is compiled into it comes
  from the release build's own definition.
- Stand-ins: Google sign-in, Electron's window and key store, the Mac's Claude and Codex quota
  logins, and the Tracker's port (the computer's real Tracker is never reached).

Not green yet: View spec needs its document carried over the linked connection (zt43ae).
