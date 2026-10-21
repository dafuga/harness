# Mobile category navigation fit

The mobile navigation currently shows a clipped Helpers label and hides later categories. All seven category links and their text must fit visibly within the mobile navigation and viewport, with no hidden horizontal scroller. Preserve actual category navigation, search/settings, revision icons, environment order, deployment light/modal, single-line Updated at summary, frame and padding. Keep the desktop/mobile header compact; the existing 184px mobile acceptance bound remains authoritative. Prefer a compact wrapping navigation over hiding categories or shrinking labels into illegibility.

Direct edit units are desktop.component.nav-bar and desktop.style.responsive. Shared workspace shell is Used In; existing Select, EntitySearch, WorkspaceLink, project/revision/environment pickers and deployment components are Uses/dependencies to retain. CSS has no explorer page. Opus makes the actual bounded visual edits in an isolated worktree; Codex owns regression proof, integration and Git.

## Attribution and coverage gap

The earlier compact-header landing 5a3d6047 introduced invisible horizontal scrolling and e0767195 placed categories beside search while retaining a 60px minimum tab width. Those Codex/Opus changes produce the current clipping; the timestamp copy change merely exposed it in the screenshot. Existing ui-search-fit opened() checked that the navigation container was visible, while fits() checked search/revision bounds and document width. A visible container and non-overflowing document do not prove its clipped children are readable.

## Durable prevention

Strengthen the existing fits() acceptance guard across all supported viewports to check every category link and visible label against both navigation and viewport bounds, including text overflow. Add 320px to the standard width matrix and exercise the final Models category as well as Pages, closed/open search, and modifier navigation. This reusable acceptance check runs in normal desktop E2E verification for every future category, rather than only asserting the reported Helpers label. Preserve screenshot-before-assert checkpoints and prove the guard rejects the original layout in an isolated workspace after repair. No new workflow or policy file is needed.
