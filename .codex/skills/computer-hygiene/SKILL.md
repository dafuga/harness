---
name: computer-hygiene
description: Use whenever a session (or Chief of Staff) opens, drives or manages apps, windows, browsers, simulators, containers or background processes on Daniel's computers (primary Mac, MB2, the box) - close what YOU opened once it's no longer used, and never close anything Daniel opened. Read before computer use, browser automation, iOS/Android simulators, Docker/colima, dev servers or test runs, and before finishing a task.
---

# Computer hygiene: close what you opened, never what Daniel opened (Daniel, 27 Nov 2026)

"When we're managing computers, like we are right now with my main laptop and my secondary laptop, we need to close applications or windows that are no longer used. Although we have to be careful not to close things that were opened by the user, myself."

## Managed Tracker runs

Use the launcher’s resource commands on the host. They create and record ownership together and print the resource ID for early cleanup.

- `harness hygiene tab [URL]` and `harness hygiene window [URL]` create a target in automation Chrome on loopback port 9333. A window closes when its last tab closes. Leave any window with independently opened tabs intact.
- `harness hygiene simulator SOURCE-UDID` clones the source before booting it. Use the returned UDID for tests. Keep existing devices untouched.
- `harness hygiene container IMAGE-ID [COMMAND...]` starts a run-owned container from a local image. Supply its full sha256 ID.
- `harness hygiene process -- EXECUTABLE [ARGS...]` starts a run-owned process group. Use a foreground command that keeps its children in that group. This applies to disposable test dev servers and watchers. Reuse shared app previews according to their project rules.
- `harness hygiene close RESOURCE-ID` closes a resource as soon as you finish with it. The launcher also sweeps the ledger at exit, stop, or the configured run limit. The attempt’s private `hygiene/cleanup.json` lists any closures it could not confirm.
- Manage app windows opened through native computer use yourself. On a remote host use that host’s managed run or close resources through the opening tool. Keep a record of those resources and report any that remain at handoff. In a Docker guest, use tools inside the guest’s own isolation rather than reaching back to the host.

## 1. Keep a list of what you open

- Every time you open something, record it in your task's notes or a small file in your worktree (e.g. `.opened-by-agent.txt`): app name, window title or tab URL, PID, simulator UDID, container/profile name, dev-server port, tmux session.
- Prefer things that are easy to identify later: a dedicated Chrome profile or the automation Chrome (CDP 127.0.0.1:9333), a named simulator (e.g. `<item>-proof`), a named container, a labelled tmux session.

## 2. Close it when you're done with it (not only at the end)

- As soon as a window, tab, simulator, emulator, container, dev server, test runner or helper process is no longer needed, close it. Examples:
  - Browser tabs/windows you opened: close them (via CDP or the same tool that opened them).
  - Simulators: `xcrun simctl shutdown <udid>` (and `delete` only for throwaway ones you created).
  - Containers: `docker stop/rm` the ones you started; leave profiles you didn't create alone.
  - Dev servers, watchers, background test runners: kill their whole process tree (`pkill -P`, process group), not just the parent, so no orphans are left.
  - Apps you launched for computer use (e.g. Simulator.app, Xcode, Preview, TextEdit): quit them if nothing else of yours needs them.
- Before `tracker done` or a handoff, check your list: everything you opened is closed, or the done note says what was left open and why.

## 3. Leave Daniel's browser and other work alone

- Never read, snapshot, switch, or close Daniel's own browser tabs and windows. Do not inspect his active tab to find out what it contains.
- Browser verification must launch its own browser with a disposable profile and a private debugging endpoint. Use only the endpoint from that launched instance. Close the test-owned browser during teardown.

- If you didn't open it (not on your list), don't close it. This includes his Chrome windows and tabs, Mail, Messages, Slack, his editor, terminals and tmux sessions he uses, Finder windows, music, calls, documents.
- Never quit an app that Daniel also uses (Chrome, Slack, Mail...) just to close your own window in it: close only your window or tab.
- When unsure whether something is yours: leave it open and mention it in your note. A stray window is cheap; closing Daniel's unsaved work is not.
- Never close another session's things either (other agents' tmux sessions, simulators, containers, browsers): if they look abandoned, tell Chief of Staff instead.

## 4. Heavy things belong on the right computer

- No simulators/emulators on MB2 (it runs production probes); use the primary Mac, one at a time, and shut it down after.
- Respect host load: if a Mac is overloaded, close your own idle heavy things first.

## Chief of Staff

CoS checks both Macs every tick: leftover simulators, orphaned test helpers (ppid 1, older than 30 min), stopped-but-open apps from finished sessions; closes those that clearly belong to finished agent work without asking, and never touches what Daniel opened.
