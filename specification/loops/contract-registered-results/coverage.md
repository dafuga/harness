# Registered class results

The four existing TestExpectationService method cases stay fixed. Its registration
cases now reject unsupported example implementations and wrong class results.
The broken runner produces two assertion failures and two passes; these are product
failures, not fixture or environment failures.

Review found descriptive placeholder outputs in DevicePairingService, the relay
validators and CheckRunService cases. Their callbacks previously returned nothing.
Before changing the product runner, the existing callbacks now return real observed
values or explicitly documented projections. Original deep value, field, wire,
boundary, invalid-input, lifecycle and failure assertions remain in place.
Randomized validator values are still asserted by complete equality, while their
displayed projection records actual field types. Device outcomes project actual
wire state, real credentials and actual error names. CheckRun returns its observed
passing status and actual tool version. No callback fabricates the authored answer.

Counts remain four runner cases, two CheckRun cases, 20 DevicePairing cases,
56 HostPairing cases and five relay validator cases. On harbor-mbp-2 the 83 consumer
cases pass before the runner repair. Root, Remote and Relay compilers, focused lint
and all three structure audits pass. A missing HARNESS_CLI_PATH blocked the first
workspace audit invocation; supplying the normal project CLI path repaired that
verification environment without changing source.

The first draft comparison caught a fixture observation-order error: polling added
a second recorded body before `wireRequests` was read. The original assertion
correctly requires one request body before polling. Snapshot that real count at
the original observation point, then poll. Keep the authored expected value at one.
Commit this fixture correction separately and record a fresh red checkpoint before
pairing the product repair; the earlier checkpoint is retained, never overwritten.

Final matched proof on harbor-mbp-2:

- Test checkpoint: `36ac722913ecb13d0aa234782ef75467db059f94`.
- Product repair: `91ed9154a148393079605679f4cbe3853b9548f4`.
- Red: `b86a1f47a25b5984a6fe7c2c28e2038c6d33033ca1d6ca14ca82c2e7006b847a`.
- Green: `17ca6a3e52b4162574d7f0275610b55bf70efde2222ec7cb80b881963f2022a6`.

Red records two product assertion failures and two passes; green passes the same
four existing method cases. Both runs share one resource lease and unchanged
command, environment, complete test corpus and authored expectation digests.
Normal focused qualification passes all 87 runner/consumer cases. Root typecheck,
focused lint, structure audit and registry validation pass. Full aggregate, visual,
Examples playback and complete history acceptance remain pending.

Broader qualification at `91ed9154a148393079605679f4cbe3853b9548f4` passes
all 692 cases across the 44 declared matrices, plus 16 unchanged ownership and
readability checks: 708 passes. This includes the ten CLI cases on harbor-mbp-2,
with an observed peak of one active worker, matching the project's cap.
The full aggregate check is a separate pending gate.
