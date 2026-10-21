# Mobile header polish

Refine the mobile header with Opus: establish a clear project identity row, group environment and revision controls coherently, and give category navigation a calm visual hierarchy. Preserve the existing shared Select, ChoiceDialog, EntitySearch, ProjectSwitcher, RevisionPicker, and DeploymentActivity components, their accessible names, state, focus restoration, and deployment boundaries. Desktop keeps environment left of revision and deploy controls.

The existing workspace selector scenario covers 320px and 390px dev/prod, available controls, overflow, and header height, but only checks visibility of the revision container. Its short fixture branch can be truncated until unreadable at 320px. Strengthen that scenario to require the short current branch name to fit; arbitrary long branches may still ellipsize. Capture before/after at the same checkpoint. Preserve the 164px local-header maximum. Subjective polish is reviewed visually rather than represented by fabricated aesthetic assertions.

Verification: unchanged strengthened workspace test, deployment/activity/search/project browser scenarios, affected component tests, desktop type/lint/build/audit, root check, and fresh manual mobile/desktop browser evidence. No application release or deployment backend change.
