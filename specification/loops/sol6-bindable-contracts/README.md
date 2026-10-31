# Bindable contract requiredness

The standard source-index contract case exercised required props, optional props and a literal size fallback, but no bindable fields. Indexing marked every binding initializer optional, including `$bindable()` with no fallback, so reindexing erased the required source-type flags of GameLevelBrief provider/model, GameViewFields section and ExplorerControls filter.

Strengthen that existing case with required and optional no-fallback bindings plus a binding with a literal fallback. Keep the same wrapper/forwarding and reindexing checks, and measure the actual scan workload. The repair should preserve the source type's required flag when no fallback exists, without changing literal defaults or optional source declarations.

Undefined optional defaults are explained as omitted JavaScript values in contracts; JSON cannot store JavaScript undefined. Source indexing remains authoritative for input flags and literal defaults.
