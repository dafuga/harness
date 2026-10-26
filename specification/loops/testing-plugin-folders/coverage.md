# Testing resource folder admission

The generated-project scenario passed browser/audio execution, typechecking, lint,
unit tests and build, then its final audit rejected tests outside tests/e2e.
The initial foundation admission checked config categories but omitted resource
files and directory-level findings.

The existing audit fixture now generates both testing resources and checks their
source and ancestor folders for category and E2E structure violations. Both suites
and their private browser support move under tests/e2e, preserving the app's own
support folder. Relative config and audio-service imports follow the new paths.
The original failing snapshot replays all three directory findings; the unchanged
audit test must pass after repair.
