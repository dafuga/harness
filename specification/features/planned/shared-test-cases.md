# Feature: shared test cases

Show recorded test inputs beside their observed outputs through EntityCases in both Harness viewers, including Tests and the workspace Evidence tab. Keep the exact selected revision and its parent separate; a branch tip has only its current cases.

Acceptance: every verified output/assertions/trace result uses the same table. False, zero, null and errors retain their types. Matcher expected/actual values never become function calls. Unread, refused, mismatched and missing artifacts remain explicit gaps. Assertions, steps, traces and full raw results stay available. Component, page, config and service observations are labelled end-to-end observations; function invocation records retain symbol and unit checks.

Each case leads with its name above generous input and output panels. Narrow containers stack the panels without widening the page. Short JSON arrays and objects stay together; bounded previews scroll locally and label shortening. A lazy disclosure preserves the full original recording. Formatting serializes each source value once and retains JSON types, escaping, and serialization behavior.

The workspace Evidence tab keeps its coverage verdict and adds the existing behavior renderer. Source files stay in Details. Screenshot/audio and permission behavior remain governed by their existing contracts. No new parser/envelope, deployment, auth or cache policy is introduced.

Verification uses frozen regressions, opt-in before/after captures, actual DOM observations over synthetic fixture history, mandatory source-stamped screenshots and a separate trace of real UI inputs/outputs. Terminal matcher output stays separate. Missing-case data is not backfilled into old commits. Final clean integration verification remains owned by the delivery task.
