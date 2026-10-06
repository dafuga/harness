# Harness analytics and reports

Bundle Project Reports into Harness while preserving media, manifests, exports and publication.
Record local durable cross-project CLI, loop and Jev metadata without raw source or prompts.
Expose summary, loops, jev, models, events, import and explicit snapshot export commands.
Link checks with loop/step or task identity and record authoring model separately from Jev.
Count substantive first assessments; exclude cached-only, dry-run and incomplete attempts.
Retain analytics independently from 30-day report retention.
Ship prebuilt website and viewer assets usable outside either source checkout.
Prove CLI behavior, metric semantics, packaging and responsive dashboard regressions.

## Delivery status

The analytics store, CLI, check attribution, worktree-aware historical import,
report packaging, shared dashboard aggregation, and compatibility bridge are implemented.
The dashboard frontend is pending: the required Claude visual edit failed because its
OAuth session expired. Its bounded brief is saved at `/tmp/harness-analytics-visual/brief.txt`.
The unchanged dashboard browser regression still fails on its missing heading.
Existing report header layout failures reproduce in the original frontend and are
recorded in the active feature report. No application or analytics snapshot was published.
