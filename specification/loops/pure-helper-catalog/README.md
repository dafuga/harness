# Helpers, services and models

The global Helpers catalog lists reviewed, synchronous pure value transformations with at
least two distinct actual component, service or named-function consumers. Formatting a date
or converting case fits this category. Network requests, storage, mutation, clocks, random
values and reads of hidden state do not. Sharing alone does not make an operation a helper.

Source declarations use `@pure`. A conservative syntax guard rejects unsupported effects and
hidden dependencies. This is a reviewed source contract, not a formal proof for arbitrary
JavaScript, custom methods, getters or hostile input objects. Unreviewed exports are excluded.
Eleven existing shared formatter exports were reviewed for this change; the much larger
inventory of shared callable exports is not presented as a list of pure helpers.

Services holds registered service classes and capabilities. Models holds registered data types
and schemas. Existing unit identities and `/functions` addresses are preserved for deep links,
source, ownership and history. A private helper stays beside its owner under the existing
single-consumer ownership rule. This change does not invent placeholder models or services.

## Consistent revision data

Normal `units index --write` derives and commits `helperContracts` with each unit manifest.
`units check` detects stale declarations. Native and hosted catalogs read these declarations;
they do not scan source on every click. Their snapshot profiles are versioned so a catalog
cached under the previous policy is not reused. The web history explorer derives metadata
from the source of the selected revision. Missing historical declarations never imply purity.

## Regression evidence

The test-only commit `3c650c4e` precedes product fix `f22e91fa`. The frozen command fails
its metadata/category expectations first and then passes 20 metadata and 18 catalog cases.
The existing browser catalog flow also fails its Helpers-heading assertion before the fix,
then passes with Helpers, Models and Services navigation at the same selected commit.
Before/after images are local verification artifacts and are not committed.

Client parity has a separate test-only commit `0da4c37c` and fix `e8f8e3a5`. The unchanged
CLI indexing command fails its committed-helper-contract assertion, then passes at the fix.
The standardized native catalog suite proves that a pure shared formatter is listed, an
unreviewed operation is excluded, and models and services retain separate categories.

Full verification results and known blockers are recorded with the loop before handoff.
No native application UI is launched or tested for this change, as requested. This work is
on `dafuga/regression-commit-history`; it is not a main-branch or production release.
