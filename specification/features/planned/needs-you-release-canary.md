---
status: planned
shippedIn: null
unitIds: []
owner: null
reviewedAt: null
---

# Needs-you release canary

26 Nov 2026 (eq0hnw, retro ecw4cy). Three Hub releases were marked done although nobody had seen
signed-in production Hub, and web answers did not reach the Tracker. A Hub release now has one
scripted check to run after it is deployed:

    bun scripts/needs-you-canary.ts --release <release item id> [--tap web,mac,iphone]

- For each surface (Hub web, Mac app, iPhone) it raises its own test ask, labelled as a release
  canary, on a new item that never launches a session. The ask names one randomly chosen option.
- Hub web is answered by the script in its own tab of the automation Chrome, on production, by
  pressing that option on the "Blocked - needs you" row. A row without option buttons fails.
- A surface named in `--tap` is answered by Daniel by hand. This is the only way for the Mac app
  and the iPhone.
- A surface passes only when the Tracker then reads back its own app's `answered_by`, with
  `answer_option` and `answer` equal to the named option, on an ask that was unanswered when the
  surface was reached. `answered_by` is `Daniel via Hub` for Hub web, `daniel` for the Mac app and
  `Daniel` for the iPhone. `test/needs-you-canary-answer-paths.test.ts` reads each from that app's
  write code, so a change there fails the test.
- `answered_by` names the write path, not the device or the person's hands. A Hub tap in a phone
  browser reads as Hub web, and `daniel` is also what `tracker answer` writes without `--by`, so the
  Mac result also rests on the instruction.
- Every test item is closed afterwards, passed or not. A cleanup that fails is not a pass.
- A Tracker restart or release does not end the run: a command the service did not answer is
  repeated for up to five minutes. A refusal is not repeated. If the service stays down longer, the
  check fails. A reply lost after a write can repeat the write: a second note, or a second test item
  that was never flagged, so it asks Daniel nothing but stays open until closed by hand.
- The result is noted on the release item. Unless all three surfaces pass, the release item is
  flagged with an exact ask for Daniel and blocked. A later pass removes only the canary's own
  flag and block.
- The script reads one yes or no from the Hub (whether the browser is signed in). It never reads or
  prints cookies, storage, headers or the account, and takes no screenshot of the live Hub. It
  opens and closes only its own tab and does not sign in.

## Running it

Run it on the computer with the automation Chrome (primary Mac) after every Hub, Mac or iPhone
release, before the release item is marked done. Exit code 0 means all three surfaces passed; 10
means the release item is now held; 1 means the check could not run, so nothing is proven. With
`--tap`, run it while Daniel is free (`--tap-minutes`, default 10 per surface). Stopping it midway
can leave a test item open; close it with `tracker unflag <id>` and `tracker done <id>`.
