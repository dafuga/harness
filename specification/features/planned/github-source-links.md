# GitHub source links

The Source tab contains only links to owned files on the project GitHub repository, pinned to the selected commit. It omits symbols, execution targets, internal identity and version metadata.

The history index carries an optional canonical GitHub repository URL derived from the configured origin. HTTPS and SSH origins normalize to the same address. Credentials, query strings and fragments are never copied. Non-GitHub or missing origins remain unlinked.

Existing detail rendering and responsive entity navigation tests currently assert only ownership text. Strengthen those standardized cases to check safe destinations at branch tips and selected commits, and absence of extra metadata. Extend history-index determinism coverage to retain the normalized repository address. Missing or invalid metadata must not invent a link.
