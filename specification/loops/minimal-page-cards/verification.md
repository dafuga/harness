# Verification scope

- Page-card regression: failing test commit `0d44843e`, passing fix `64ee5cbb`; same command and frozen inputs. Three Reports widths and six local/hosted widths passed.
- Preview binding regression: failing test commit `360ca8c2`, passing fix `aea3edc3`; the registry preserves the explicit preview and missing states never use another image.
- Reports: 578 unit cases and 65 browser cases passed; types, lint, formatting and three builds passed. A file-length audit failure was corrected by removing blank lines; the audit then passed.
- Shared renderer: 19 browser cases and 11 screenshot-selection unit cases passed; types, changed-file lint and static audit passed.
- Root: 20 focused integration/utility cases, types, lint, static audit and the 1,268-unit registry check passed.
- Captures use the existing declared scenarios and sealed Git evidence, with exact build and source identity. Their records distinguish browser fixtures from native application acceptance.
- Electron/iOS testing and the root aggregate check remain paused. The scoped capture record must retain failures for unrun scenarios and unreviewed budgets; it must not claim full repository verification.
