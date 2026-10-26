# Plugin CLI measurement admission

The plugin measurement extension included a third command argument to distinguish
plugin ids. Discovery has no plugin id: its third argument can be `--json`.
Joining that flag produced `plugin-list---json`, which committed measurement
history rejects. The CLI scenario passed without validating its captured rows
through the measurement schema used by the history reader.

The standard verification-observation suite now exercises discovery with and
without flags, plugin ids across operations, and the modules guide. Each capture
must retain the CLI result, identify the intended workload and pass the committed
measurement schema. The unchanged matrix protects the fixture repair.
