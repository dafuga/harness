# Viewer and state review

The existing `explorer-shell-component-catalog.spec.ts` checked the no-navigation heading,
catalog row counts, viewer visibility and table presence. It missed disabled navigation,
displayed-side capture/record provenance, separator spacing and whole-word cell geometry.
The ordinary named catalog test now calls those reusable assertions after retaining its image.

At `f646af2a1e`, independent record
`f1cd47a4f3ceb050725386762405cc4aaa5080871857546f0a4daf77bda4283c`
passed the old assertions. Its 18 original images were decoded and inspected: empty navigation
still showed enabled arrows and a keyboard hint; the After view used Before metadata;
the mobile Required cell split `inapplicable`; all/multiple showed the same three cards;
the desktop config dialog had a narrower capture. One desktop viewer image also retained a
loading status, so final screenshot readiness must be checked separately.

Before the matched checkpoint, fixture/capture corrections make multiple show two linked
components, preserve the full catalog context behind the config dialog, and rename the scoped
scenario to Order browsing. Those are diagnostic fixture repairs, not product red/green proof.
No original capture or recorded artifact bytes are relabelled. Unrelated fixtures stay unchanged.

The frozen product regression selects EvidenceViewer/no-navigation, EntityScreens/viewer-open,
EntitySections/tests and EntityTests/default at desktop, tablet and mobile. The product repair
must preserve the complete test/fixture corpus. Normal verification and attachment then retain
every state of those owners and CatalogItems. EntitySearchResults is refreshed to confirm note 40.
