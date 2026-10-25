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
