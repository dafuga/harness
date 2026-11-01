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
scenario to Browse customer orders and delivery status. Those are diagnostic fixture repairs,
not product red/green proof.
No original capture or recorded artifact bytes are relabelled. Unrelated fixtures stay unchanged.

The frozen product regression selects EvidenceViewer/no-navigation, EntityScreens/viewer-open,
EntitySections/tests and EntityTests/default at desktop, tablet and mobile. The product repair
must preserve the complete test/fixture corpus. Normal verification and attachment then retain
every state of those owners and CatalogItems. EntitySearchResults is refreshed to confirm note 40.

The first red request was refused because its named word-wrap assertion did not occur.
Independent diagnostic `4c55a39fd0d19afdddb9e5ba8dcd21a658383bb3ae431974ee83ed236500db8f`
retains the actual result: six navigation/provenance assertion failures, three passes for Sections
with a shorter title, and three EntityTests fixture failures requesting unserved function artifacts.
Before retrying the pair, the standalone EntityTests example now uses the same Orders evidence
and behavior as its Sections consumer. Its realistic longer scenario title preserves coverage of
long declarations. Fixture failures do not count as product regression proof.

Matched red `a2d0368fcce7f4aa682092bece4b1f55c03638b199a2547c3d51c2cfeffc1920`
at `d31c7d3407` retains eight assertion failures and four passes, without fixture errors.
Green `2f4cd5d6fc8b23492ed096fc83bf30ca1823db79ea2eaec8c4514726b4e00561`
at `dd3bd67e8f` passes all twelve cases with identical inputs, tests, fixtures, command and
environment. Both sets of original images were inspected. An earlier passing green still split
the mobile Proven label; the final source preserves both value columns and removes the row
heading's unnecessary minimum width. One desktop viewer image caught a transient loading
status after opening; the final independent recording must wait for the image controls too.
