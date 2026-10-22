# Feature: Agent Creation

## Overview

Create pages, components, functions, configs and services by talking to the project agent in
the bottom-right corner. The existing entity thread remains the place for scoped follow-up.

## Acceptance Criteria

- Catalogs have no title/goal creation form or New entity button.
- A compact bottom-right agent control opens a conversation with the shared Composer and
  AgentControls. Plan/Change and the actual CLI, model and effort stay in the input.
- A creation Plan is an explicit project-scoped startRun request. The selected CLI proposes
  a bounded category, title, goal and contract/design direction; validated results become a
  committed plan and its original request becomes the first entity-thread message.
- No caller-supplied source path or model text may become a write instruction. Invalid
  proposals, unavailable models, cancelled preparations and historical views cannot create.
- Read-only, pinned and unbound views name the launcher Open project chat; only a view that can use the agent names it Work with agent.
- Creation is Plan only. Change uses an existing entity's exact approved design. A new plan
  never claims code changed or tests passed. Visual plans use the existing image pipeline;
  functions use behavior notes, with no design images.
- Hosted projects offer human commenting on entities without an AI launcher or creation
  endpoint authority. Preserve project, branch, revision, approval and remote grant checks.
- Tests prove the actual selected provider/model request, plan persistence, original message,
  invalid proposal refusal, cancellation, concurrent-client exclusion, and scoped navigation.
- Inspect fresh desktop, tablet and mobile screenshots and exercise the browser manually.

## Future Enhancements

- Voice and attachments are outside this change; omit inert controls from the reference.
