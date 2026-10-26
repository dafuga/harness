# Headless runner config admission

The first admission matrix checked --headed but omitted short attached config
arguments. Playwright accepts -cfile.ts, so the guard must reject that form before
installation can create files or runner execution can begin.

The existing command test now covers headed, debug, UI, long config, separated
short config and attached short config flags. A setup spy throws if admission
reaches installation, keeping the failing test side effect free. The repair
rejects every -c form and preserves normal runner arguments. The isolated failing
checkpoint replays the original guard; the unchanged matrix passes after repair.
