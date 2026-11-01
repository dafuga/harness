# Whole evidence headings

`58cc11a5a0` contained opaque record identifiers by applying `overflow-wrap:
anywhere` to all of EntityView. Saved-image review at `6ac9038150` shows the mobile
Recorded runtime evidence heading broken inside words. The previous working
scope did not apply that rule to headings; this regression was caused by our fix.

The catalog checked record-caption bounds and whole table headings but omitted
flex-panel headings. The earliest missing control was the shared post-capture
geometry assertion. It now checks each painted heading word in evidence panels
across both EntityView and RuntimeEvidence, at every declared state and viewport.
This extends the existing standardized cases without adding cases or a new suite.

The repair scopes arbitrary wrapping to the opaque coverage-record caption.
Ordinary headings retain their natural word boundaries. Keep the record-ID and
table guards unchanged, so restoring readable headings cannot restore overflow.

Prove the strengthened catalog red in a committed snapshot, then preserve the
same tests and environment for green. The broken isolated snapshot also proves
the guard rejects reintroducing broad inherited wrapping. Current unit contracts,
owning checks, measured workloads and inspected API images remain required.
NavBar stays rejected and deferred; this work does not authorize its Opus draft.
