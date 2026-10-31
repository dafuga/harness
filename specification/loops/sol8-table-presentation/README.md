# Explorer table presentation

Item 40's current-code API captures show category examples without rows, empty
feedback outside the table frame, and three-line configuration text on one line.
The committed archive path is already realistic and requires no repair.

The standard component-catalog scenario accepted missing category data whenever
any empty message was visible. Its string assertion explicitly required nowrap,
including the multiline example. It never checked the empty message's table cell.

The existing category variants now supply representative API, layout, model, type
and website rows. Local fixture descriptions use product copy while source comments
retain provenance. The website row represents configured metadata, not deployment
verification. No scenario or viewport is added.

After the canonical capture, the unchanged standard matrix requires category rows,
an empty body cell spanning its headers, and three painted lines for the multiline
literal. The red/green command selects the existing empty and multiline states at
all three viewports. Fixture correction is frozen before that product regression
pair; the product repair must change only empty-row and multiline rendering.

## Validation

- Red `b75608d653a6` at `53a25c7d06`: six real assertion failures, with six retained captures.
- Green at `af1e1c9478`: the same frozen corpus and command pass all six cases.
- Full catalog `08b93ccb8d48`: all fourteen states at desktop, tablet and mobile pass; all 42 original API images were inspected.
- Normal recording `3d2fea961e10` is attached at the fix commit; all catalog capture slots pass. Its enclosing scoped verdict remains partial/failed.
- Root contract/index guards pass 23/23; root TypeScript and both Reports Svelte checks pass. Root units: 1,372 passed, 26 skipped, exactly the two supplied baseline failures.
- Inherited Reports unit wording failure, TypeScript/lint/audit findings and root formatting failures remain. Full-check verification stays pending; focused visual proof is not a full project verdict.
- Exact-tree source observations and fresh per-state timing/renderer-memory measurements are retained in the external progress report. No screenshot artifacts are committed.
