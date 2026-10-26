# Feature: Design Approved Work

## Overview

Harness users request a feature through CLI or project chat. The agent discovers affected modules through committed contracts and generates GPT Image designs for every visually affected page, using available wanted or current designs as image inputs. The user selects page options and approves a committed feature plan before implementation begins.

The feature plan presents the overall goal, parent modules, component/function/service changes, wanted contract differences, exact worker file assignments and dependencies. Independent work runs in parallel within shared CPU and memory admission. A parent task starts only after all its dependencies are accepted. Chat and a Work section in the existing floating panel show the same durable task progress.

## Proposed interface designs

The three generated images are proposals for the persistent project chat and Work interface. They are not screenshots of implemented behavior. All use the actual current Harness panel and Pages screen as their visual reference; the available preview reference was branch `dafuga/contract-test-policy` at `6e1db0b`, not a claim of current-main delivery. Example task status and names are illustrative.

- [Option A — compact tree, preferred](design-approved-work/option-a.png)
- [Option B — feature list and tree](design-approved-work/option-b.png)
- [Option C — activity timeline and tree](design-approved-work/option-c.png)

Selection: pending user choice. The chosen image is design direction; the implementer must use existing shared controls and accessible status labels.

## Planned module tree

- Feature planning and approved contracts
  - Planning store and API: feature plan revision, affected page image bindings, alternatives, preferred option and selected option, parent/module tree, current-versus-wanted contracts, source revision and approval identity.
  - GPT Image planning: generate three alternatives by default for each visually affected page, retain supplied/current image inputs and generation provenance, and report missing references or failed generation explicitly.
  - CLI and app chat: create and inspect plans, show options and contract changes, choose an option per page, approve an exact revision and follow progress.
- Task execution
  - Task schema and server: persist dependency IDs; reject missing or cyclic dependencies and stale plan approval; create the complete feature task set idempotently.
  - Scheduler and worker: start accepted-prerequisite-ready tasks in parallel under shared CPU/memory admission; preserve exact assigned-file isolation and reusable goal/TLDR prompt prefix.
  - Review and metrics: independently accept or return submissions; retain reported model, usage, pricing provenance, return-for-fix history and separately attributed primary cleanup.
- Project chat and Work
  - Existing floating chat and shared controls: show design options, plan and contract tree, approval and chat progress.
  - Work section: list features and expand parent module/component/function task trees; gray To do, amber In progress/review, green Accepted and explicit blocked/failed states, all with text labels.

## Acceptance criteria

- Each visually affected page has generated design choices and an explicitly selected image before the feature plan is approved. Nonvisual work uses a written plan without unnecessary images.
- Approved source, image hashes, contract changes, dependency graph and file grants are bound to one immutable plan revision. Any change in reviewed scope requires a revised approval.
- No implementation task starts without approval. Parents wait for accepted dependencies, ready independent branches use available resource leases, and overlapping write grants never execute concurrently.
- CLI and app chat expose the same saved plan, selected designs, contract diffs, task statuses, failures and reviews, respecting project permissions and hosted executor availability.
- Restart, retry and duplicate requests do not duplicate tasks or silently repeat provider spending. Execution records retain actual model/usage when reported and explicitly mark unavailable values.
- Unit, integration and remote E2E checks cover image inputs, design selection, revision-bound approval, dependency cycles and readiness, resource waiting, isolation, retries, restart, and shared UI status. Actual GPT Image and provider runs remain separate from synthetic tests.
- Luna bounce rate is distinct reviewed tasks returned for fixes divided by distinct reviewed Luna tasks. Primary cleanup is reported separately; provider-launch and infrastructure failures are excluded from that denominator.
