# Lint testing foundations with their generated project rules

The compiler-backed CLI scenario reached its final lint step after both headless
scripts and generated-app typechecking passed. Generated lint rules intentionally
do not declare a global process binding, which left both testing configs invalid.
The earlier unit matrix formatted core project output but did not lint plugin
foundations with the generated app and library configurations.

The existing project-template matrix now formats and lints every source foundation
from testing plugins using each emitted lint configuration in a minimal typed
source fixture. It disables no rules. Explicit Node environment imports repair the
configs. The isolated failing checkpoint replays both no-undef findings; the same
unchanged app and library matrix must pass after repair.
