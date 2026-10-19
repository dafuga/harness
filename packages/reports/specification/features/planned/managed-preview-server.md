# One managed preview server

Status: planned

Repeated dev commands currently start independent Vite servers, including on different ports.
Existing browser tests only check their own isolated server; they never exercise repeated app launches.
The desktop transport also creates another listener if listen is called twice.

## Acceptance criteria

- Reports and desktop renderer dev commands use one shared local preview owner across checkouts.
- Repeated and concurrent starts of the same checkout and environment return the existing URL.
- A different checkout or history configuration is refused with the existing URL; it never serves the wrong source.
- Port conflicts never silently move to another port or kill another application.
- Startup failure, normal shutdown and owner crash release ownership so a later start can recover.
- Preview ownership uses a loopback-only, read-only status endpoint; no remote launch or stop API.
- Electron acquires its single-instance lock before creating any backend or window; reopening focuses the existing window.
- Repeated transport listen calls share the same listener and teardown closes it completely.
- Isolated automated test servers keep their independent fixture ports and normal teardown.

## Verification

Extend the standardized local transport lifecycle tests. Add the missing reusable preview-launch
lifecycle category using a tiny Vite app in a temporary workspace, real dev commands and owned
process cleanup. Commit failing proof before the implementation. No native Electron UI testing.
