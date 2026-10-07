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
The dashboard frontend is implemented with history filters, loop/template/command usage,
separate author/evaluator models, Jev task first-try rates, report links and live CPU.
Automated browser regressions prove desktop/mobile layout, real API sampling, refresh
and unavailable states. Manual browser verification remains blocked by the earlier
browser-tool URL rejection; the feature report stays active and PR #5 remains open.
Existing report header layout failures reproduce in the original frontend and are
recorded in the active feature report. No application or analytics snapshot was published.

## Canonical repository

Project Reports lives entirely in Harness under `packages/reports`. Root commands
provide reporting, frontend development, focused tests and workspace checks. The
presentation guidance and existing retention installer target Harness. Report data
and explicit credential references remain external and compatible; the old checkout
is not needed to run or develop reporting. The analytics dashboard is now implemented. This consolidation does not reinstall
the live cleanup job.

## Analytics route repair

The CLI subprocess must close its output streams before the website parses its JSON.
Large histories are covered by an isolated real-CLI regression and a browser HTTP 200
regression. Claude visual edits have been integrated and automated browser verification passes.

## Dashboard and live CPU acceptance

The reports website must expose Harness Analytics from the report hub and link back to reports. Show counts, loop/template/command usage, explicit author and evaluator models, token totals, first substantive Jev attempt rates and excluded checks, task attempts and report links. GET filters retain project, loop, task, model and UTC date bounds. Empty selections show No assessments rather than a zero rate. Desktop and 390px layouts must fit the viewport.

`harness analytics cpu --json` and the localhost-only `/api/analytics-cpu` route sample process CPU-time deltas and machine CPU counters over one second. Live cards refresh every five seconds while visible. Show overall machine usage and disjoint Codex app, Harness and local-agent totals; percentages of the machine and of one core are labelled separately. A process is counted once, including descendants. Individual agents are identified by safe name and PID; shared Codex app-server work cannot be assigned to a chat or model, and remote inference CPU is outside this measurement. Process arguments are never returned or stored. Missing permissions or unsupported platforms show unavailable without stale values. CPU readings are live, not persisted in analytics history or published reports.
