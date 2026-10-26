# Project modules

Projects install built-in or project-local capability modules. A module declares resource types, generators and instructions. Installed types appear under Code; Modules lists available and installed capabilities at the selected revision.

## Acceptance

- Email uses the BuildFlexity Resend boundary with server-only settings, a development disable switch and reusable mailer resources. No live email is sent by installation or tests.
- Offline reuses the Fluora offline-sync engine and BuildFlexity scoped incremental background download pattern. Durable queued writes survive reload; conflicts remain pending for resolution.
- Modules define their own resource generators without changes to a central resource enum. Project-local definitions use the same validated contract.
- Installation and generation reject collisions, unsafe paths, symlinks and invalid definitions before writing. Reinstallation is idempotent.
- Navigation preserves branch and historical revision. Missing historical catalog data stays explicit.
- Extend generator/service, standard shell browser and component-catalog tests; retain red and green evidence. Run automated E2Es only on harbor-mbp-2.

## Reference inspection

Fluora: src/lib/offline/{db.ts,sync.svelte.ts}, workspace-sync.ts and the shared offline-sync package. BuildFlexity active offline branch 289fff40d: OfflineCoordinatorService, OfflineDownloadStreamService, offlineDownloadStream and offline-download route. BuildFlexity email: src/utils/email.ts. Applications retain ownership of authorization, data schemas, locale and credentials.
