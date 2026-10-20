# Parameters, Returns and Throws

Every callable contract now keeps three separate tables: Parameters, Returns and
Throws. Empty parameter and error tables retain an explicit absence row. Throws
lists only that function's declared exceptions, with their types and full examples
behind the existing info control. An empty contract says `No errors declared.`;
this is not a guarantee that arbitrary invalid runtime calls can never throw.

The casing helpers' actual source parameters are renamed from `value` to
`textToConvert`, including their internal word splitter. Their declared contracts
and source-derived helper inputs use the same name. Positional call semantics,
normalization and examples stay the same.

## Actual consumers

These are existing pure helpers used by Harness's CLI and generators. The source
inventory confirms real callers; these counts are registered consumer units, not
runtime execution counters.

| Helper         | Consumer units | Example source use                                                                                   |
| -------------- | -------------: | ---------------------------------------------------------------------------------------------------- |
| `toKebabCase`  |              8 | `src/templates/appPieces.ts`: generated file names and route names                                   |
| `toPascalCase` |              8 | `src/templates/appPieces.ts`: generated component names; `src/templates/model.ts`: model class names |
| `toCamelCase`  |              7 | `src/core/fields/fields.ts`: field names; `src/templates/appPieces.ts`: store and hook names         |
| `toSnakeCase`  |              2 | `src/core/fields/fields.ts`: database column names; `src/templates/model.ts`: table names            |

Each therefore has consumers in at least two registered units. The browser displays
their committed contracts; it does not execute the displayed authored examples as
part of rendering a contract table.

## Recorded proof

- Failing-test commit: `7af3cb1213e48acdb01149c4bc8e4d27d457d53e`.
- Fix commit: `554a8861aeff630ade4cb98cf7537359d9848c96`.
- Failing checkpoint: `15963d15a4b6cb540be1420b0217c1c57194a7b4656cfb299fc217dc9866cbf4`.
- Passing checkpoint: `8b50de91d2db4828cd8074f5c4a84f6fd53fe62849b824f56bd48da2f018a4af`.

The existing typed-contract unit test and shared browser fixture now cover a declared
TypeError scoped to one callable, other callables with no declared errors, and a
zero-parameter function. The same frozen tests and command fail before the repair
and pass afterward, both at the branch tip and at a historical commit, across
desktop, tablet and phone widths. The error example modal is exercised too.
Generated screenshots stay outside Git in `/tmp/harness-callable-throws/`.

The Reports package check passes formatting, types, lint, all 599 unit tests,
builds and audit. Nineteen focused root casing, field, generator and ownership tests
pass. Registry validation reports 1308 units, 64 existing uncertainties and no errors.
The live casing contract and parameter modal were inspected without browser errors.
Root formatting, types, lint and Rust checks pass; the full root suite was interrupted
during unit tests. Electron testing remains excluded at Daniel's request. No native
app or production deployment was performed.
