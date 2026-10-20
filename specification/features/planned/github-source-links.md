# GitHub source links

The Source tab contains only links to owned files on the project GitHub repository, pinned to the selected commit. It omits symbols, execution targets, internal identity and version metadata.

The history index carries an optional canonical GitHub repository URL derived from the configured origin. HTTPS and SSH origins normalize to the same address. Credentials, query strings and fragments are never copied. Non-GitHub or missing origins remain unlinked.

Existing detail rendering and responsive entity navigation tests currently assert only ownership text. Strengthen those standardized cases to check safe destinations at branch tips and selected commits, and absence of extra metadata. Extend history-index determinism coverage to retain the normalized repository address. Missing or invalid metadata must not invent a link.

## Delivery evidence

Source shows only safe GitHub file links at the viewed full commit. Git origin supplies the optional canonical repository URL, normalizing SSH and HTTPS without network requests. Existing source rendering and navigation cases now assert destinations and revision scope instead of file text alone.

The committed regression fails at c197eff0 and passes unchanged at 276f672b. A subsequent list-key correction at 8033f074 passes the existing uniqueness guard and rendering cases. The final standalone recorder attempt refused a changed environment; it does not replace the valid earlier red/green pair.

Root types, lint, audit and registry checks pass. Reports types, lint, build and audit pass. The broad web suite passed 608 tests and exposed the list-key issue; all 11 affected tests pass after its repair. Final responsive Source navigation also passes for tip and historical commits across three viewports. The main preview Source tab was inspected with a correctly pinned GitHub destination and no browser errors. Full root verification remains pending because it includes the Electron checks Daniel has asked us not to run. This change is committed locally and has not been merged into main.
