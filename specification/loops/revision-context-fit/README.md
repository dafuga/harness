# Complete revision context

The new Historical and Pinned labels in `34b102bf69` exposed the old 300px summary
cap: desktop and tablet ellipsized the selected short commit ID. The committed
catalog asserted text content, but not whether all of that context was painted.
The original green images demonstrate the clipping before delivery.

The existing component catalog now checks the rendered width of the selected
context in every RevisionPicker state at desktop, tablet and mobile. This shared
assertion covers future context labels without adding a case or relying on a
particular commit ID. The check belongs at the catalog's pre-capture acceptance
checkpoint; DOM text alone cannot establish readable selected context.

The proposed repair removes the arbitrary summary cap while retaining its normal
container boundary. Record the strengthened test failing in a clean committed
snapshot before repair, then run it unchanged on the product fix. The broken
snapshot is also the isolated reintroduction of the clipping rule.

Normal workspace navigation, catalog captures, owning typechecks and baseline
project checks remain required. A focused green record does not grant a full
repository verification verdict. NavBar remains rejected and deferred.
