# Shared presentation and compatibility review

A component has one stable unit ID. Its registered runtime entry and composition level identify
its canonical implementation. Supported public files stay in that unit's source list; they are
compatibility entries rather than independent components or separate screenshot subjects.

For each bounded migration, read the unit contract, Uses and Used In and resolve every import
against the actual build aliases. Inspect bindings, snippets, callbacks, native attributes and
focus behavior at both entries. Redirect active callers to the canonical source, declare the
shared reference bindings and retain public forwards until their compatibility commitments and
remaining consumers have been reviewed. Re-index without changing the ID, then run registry,
composition, select/search/alias impact and owner tests and typechecks. Record each changed
component's declared states at every viewport from the committed build, attach the record, and
fetch the original images through the screenshot API. Source navigation continues to list the
public address beside the canonical implementation; it never gains another visual unit.

## Reviewed batch

The plan's AnalyticsTasks pilot is deleted and is not restored. The current tree has four
CategoryImplementation entries: Select, Modal, FilterDialog and BrandMark. Each already belongs
to its canonical shared-primitives unit, whose runtime and catalog preview select the actual
implementation. All four remain supported: Select preserves its binding, the other three pass
props, and existing app aliases and public-entry tests still use those addresses.

The first internal migration redirects AgentControls and RemoteApproval to canonical Select.
Their contracts and behavior stay intact. Other alias consumers retain their supported public
entries; this review does not delete a wrapper simply to reduce a file count.

## Primitive boundaries

DataTable owns table structure, accessible scroll naming and containment; callers own rows,
headers, emptiness, formatting and actions. ContractTable and the Configs Variable/Value table
are the current pilots. AnalyticsTasks is absent.

CodeLine retains complete text and owns clipping/wrapping; callers retain inspection policy and
focus return. ContractTable and ConfigValue use it. SourceFileList retains independent folder
and basename clipping, link identity and copy/open actions; forcing those into CodeLine would
expand its responsibility.

DetailList owns keyed term/description rows with caller snippets. ContractPanel and
EvidenceProvenance use the same Reports implementation across workspaces. RecordedValue keeps
its recursive nodes, shortening notices, nested grouping and responsive tables; adapting it
would require a broader primitive than this plan calls for.
