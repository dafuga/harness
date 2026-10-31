# Native anchor affordance

The `28ebacd7b2` catalog supplied an href but inherited the app's neutral anchor reset. Its default label was an implementation name. Visual review rejected the example after assertions had checked attributes and label differences without requiring a visible link affordance.

The standard component catalog now checks every linked anchor state for link role, visible underline, destination and keyboard focus. The unlinked state must retain plain styling and no link role. The same existing responsive cases capture their pixels before these assertions, so failing visual states remain available from committed verification records.

The reusable acceptance boundary is the native-state assertion in the normal catalog test. Any future linked example or style reset that removes the affordance fails those same cases at desktop, tablet and mobile; no separate regression case or manual memory rule is added. Remaining native examples also require their short caller-facing copy instead of implementation names.

The repair supplies native caller attributes and realistic child content. Native atom implementations, registered identities and public CLI behavior remain unchanged. Red and passing committed captures retain their original source revisions and verification flags.
