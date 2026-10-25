# Harness API CLI

Users query the same APIs as the app from any directory. `harness api` supports
the local owner console and authenticated hosted projects. Existing CLI commands
remain available.

## Acceptance

- Discover named resources and operations. Read arbitrary same-server API paths
  so new resources need no CLI release. Support JSON, file/stdin input, repeated
  query fields, field selection and lossless binary output.
- Select server, project, branch and commit. Retrieve entities, contracts, source,
  history, messages, evidence, activity and provider information.
- Define a proposed contract through createPlan. Hosted writes require a bound
  executor, writer access and the verified branch tip.
- Start agents with explicit provider/model and retryable request identity;
  inspect run events and cancel through the server's existing permissions.
- Retrieve recorded page screenshots through their exact evidence bindings,
  check SHA-256 and report provenance. Missing, ambiguous and corrupt captures
  are errors. Downloads preserve the original capture's revision and outcome;
  they do not claim that a fresh verification run happened.
- Keep credentials out of URLs and output. Reuse local sessions in owner-only
  storage scoped to the server origin. Hosted tokens use a selected environment
  variable. Refuse off-origin paths, insecure remote HTTP and redirects.
- Never retry mutations automatically or bypass server authorization.

## Proof

Add a reusable HTTP-to-CLI acceptance matrix for both transports, real subprocess
output, arbitrary resources, binary integrity, session reuse and authorization.
Extend existing local-controller and hosted-agent coverage. Run focused checks,
root check, owning package checks and real local reads and screenshot downloads.
Paid agent requests and production application deployment are outside this task.
