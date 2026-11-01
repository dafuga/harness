# Read-only checkpoint controls

Saved API images show disabled checkpoint actions beside fields that retain the
editable treatment. The pane uses readonly text fields, while the advanced editor
inherits disabled semantics through a fieldset without the muted field style.

The existing catalog records the readonly states but its shared visible-treatment
guard covered only GameViewFields. Extend that same post-capture guard to the
checkpoint editor and pane; do not add cases. Check semantic disabled state,
muted opacity and the existing non-editable cursor treatment at all viewports.

Reuse the existing game-field treatment and tokens. Preserve readable field
values, the inspection-only advanced disclosure, and the Done/close controls.
GameViewFields remains the unchanged reference, including its Sol8-owned contract.
