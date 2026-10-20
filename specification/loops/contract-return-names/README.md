# Named return values and optional error tables

Parameters and Returns use Name, Type and Example columns with the existing trailing info button. Returns preserve a declared value name separate from their callable identity. Casing contracts now name kebabCaseText, pascalCaseText, camelCaseText and snakeCaseText. A helper selector preserves its qualified return declaration; declarations from a sibling helper are not borrowed. Older unnamed returns keep an explicit returnValue fallback.

Throws renders a table only for declared errors. No errors declared is a short text note. The standard browser fixture includes a declared TypeError, a named string/number return and a void return; error and return example modals stay covered at desktop, tablet and mobile sizes, at the current tip and a historical revision.

The cause was explicit presentation configuration: hideNames on Returns and keepEmpty on Throws. Existing tests asserted that earlier layout. Updated standard contract and browser scenarios now assert the requested layout and retain declared names through helper selection. ContractTable itself already supports the layout and was reused unchanged.

Test-only commit: a54f3490. Repair: 5d823200. Immutable red: 260236874c687287d5f877b0bf58cb26c2043ffea0353eb90cdecf61d042eff8. Paired green: 2e2e1879673f762481f87de135fc8429d17d3c178117d73f4b08684fd84a1836. Tests, fixtures, command and environment match in the final pair.

Verification: 601 web tests, formatting, types, lint and builds passed. The final size audit first caught a 221-line fixture; a comment-only correction passes formatting, lint and audit, and the final paired regression runs that corrected fixture. The complete web sequence was not repeated after the comment-only correction. Thirteen focused core/unit-index tests pass. Root formatting, types, lint and Rust checks passed; the full repository run was stopped before broader suites and Electron. No full-root pass is claimed. Live preview 5688 and the named-return modal were checked with no browser errors; fresh screenshots remain outside Git.

Changed units: reports.function.contract-fields (table groups and return field names), reports.function.entity-shown (selected return ownership), function.case (descriptive declared return names). Existing shared ContractTable rendering was inspected and reused.
