# Feature: Service examples

A service's evidence tab is named Examples. It explains how to create the service and then how its supported public instance methods are called, from documentation committed to the same Git tree as the service. Recorded verification stays available beside the examples, clearly separate, and never lends them a verdict.

## Acceptance criteria

- Every service entity labels its evidence tab Examples. Functions keep Examples, pages, components and shells keep States, and configs, models and any other kind keep Tests.
- Service Examples lead with how to instantiate the service, shown once under "Create the service". Descriptive calls for supported public instance methods and their distinct uses follow, each with its expected output or expected error.
- A service document without a setup says how to create it is not documented; it never guesses an instance. A missing, malformed or foreign document shows a gap, never another revision's examples.
- Recorded verification sits after the examples in a "Verification details" disclosure, under a note that the examples are authored documentation, not test results. No badge or verdict is shown on an authored example.
- The reader is the one already used by functions: the manifest's `documentation` path and its single fenced `harness-examples` block, read from the selected commit. Older revisions never borrow current or working-tree documents.
- An existing `tests` address of a service opens Examples with its branch and revision kept. The Examples tab link keeps them too.
- `AgentActivityService` documents `register`, `heartbeat`, `finish` and `roster` from its class, manifest and actual consumers (`runActivity.ts`, `ProjectActivityService.show`). Values the supplied source does not decide, such as generated ids, times, the default allowance and liveness state, are named placeholders.
- Desktop, tablet and phone layouts fit without page overflow.

## Scope

- Changed: `EntityHeader` tab label, `EntitySections` evidence pane, `EntityExamples` and `UsageExamples` setup lead, the service manifest's documentation pointer and its committed document.
- Unchanged: `AgentActivityService` runtime behavior, the documentation reader and schema, function Examples, visual States, other kinds' Tests.

## Coverage diagnosis

The standardized `entity-preview-test-cases.spec.ts` covers service Tests and function Examples, but no service Examples. Its synthetic-history fixture documents only the function. Extend the `documented` variant with an `OrderStore` document per revision (tip, an earlier one at the middle commit, a malformed one at the first) and the viewport matrix with service Examples, the missing and malformed gaps, separate verification and a config that keeps Tests. The existing service verification cases keep their titles and open the disclosure through `openVerification`. Extend `entity-tests.test.ts` for the label of each kind, `entity-sections.test.ts` for the service pane and an unchanged function pane, and `entity-examples.test.ts` for the single setup lead and the missing-setup gap.

## Verification

Pending. Integration, red/green regression records, `bun run check` and browser captures are run by the integrating agent; none is claimed here.
