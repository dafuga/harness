# Environment updated label

When the environment is selected, the header summary reads Updated at followed directly by the verified deployment date and time. The environment name is already visible in the selector and must not repeat in the summary. Branch and explicit commit summaries keep their names and existing timestamps. Preserve selectors, deployment indication and shared modal behavior.

Only RevisionPicker markup and its derived label change; ChoiceDialog, shared Select, Workspace and the deployment store are checked dependencies. No new controls or styling are needed.

The existing workspace selectors scenario asserted the former environment-name label. Replace that expectation with Updated at and reject repeated environment names or a separator dot. Keep its existing timestamp provenance, one-line bounds, mobile 320/390 captures and collapsed-control assertions unchanged. Record its real failing result before repair and its unchanged passing result afterward.
