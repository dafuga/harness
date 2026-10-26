# Node declarations in testing foundations

The standard generated-project CLI scenario reached its final app typecheck after
both headless scripts ran. It found missing Node declarations for process in the
configs and node:buffer in the audio service. The initial catalog matrix checked
headless metadata but omitted the dependencies required by emitted Node code.

The existing catalog boundary now requires Node declarations on both testing
plugins. Their package plans declare the same Node type range already used by
Harness. The full generated-project check remains the compiler-backed guard.
The committed dependency omission fails in an isolated snapshot; the unchanged
catalog test must pass after the declaration repair.
