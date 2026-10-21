# Feature: Task Completion

## Overview

Harness owns performance measurement and the final audit of coding and planning tasks. A successful agent process or free-text claim is not proof that its task is complete.

## Acceptance Criteria

- Coding completion requires clean committed source, intact verification of that revision, and representative latency and memory observations for affected executable units, independently of budget declarations.
- Harness profiling runs declared workloads, records workload, sample count, runtime profile, revision and the measurement boundary, and labels whole-process memory accurately.
- Planning completion checks the proposal, acceptance criteria, dependencies, verification and performance-testing plan without executing implementation work.
- A deterministic end-of-task audit reports missing, stale, failed and uncertain evidence; it never claims that heuristics prove arbitrary semantic correctness.
- The CLI, new task loops, agent completion and app coding/planning completion use the same checks. Cancellation and failed work remain recordable.
- Changes after an audit invalidate completion. Missing workload definitions block coding completion with an actionable message.
- Entity overviews retain expandable measured values and frozen limits after legacy Details links redirect; unavailable metrics never become zero. Source remains a dedicated tab.
- Source inventories outside Git retain authored iOS and Android files while excluding generated output; audit scope remains explicit.
- Historical records remain readable; their absent profiling cannot satisfy a new completion claim.
- This repository opts into mandatory performance evidence for plain `harness verify run`. Bootstrap schemas use explicit Harness workloads over actual parse calls, preserving the automatic observer's cycle exclusions.
- Non-JavaScript workloads retain their actual child-process timing and peak RSS through Harness captures. Standard export tests execute the real PDF and ZIP scripts; parent-runner memory cannot stand in for Python memory.
- Retention installation coverage executes the real Python main against a temporary filesystem and explicitly mocked scheduler commands; its partial profile cannot claim live scheduler installation.
- Standard native checks measure their compiled Debug and Release Swift binaries separately from compilation. These partial macOS observations cover real remote/account behavior with test transports and vaults, excluding UIKit, camera, simulator and device performance.

## Dependencies

Reuse verification snapshots, unit manifests, benchmark captures, record integrity checks, loops and the desktop run services. Do not add another agent runner or silently approve performance baselines.

## Verification

Extend standard loop, verification measurement, activity and desktop run coverage. Prove missing profiling, unsupported claims, stale audits and incomplete plans are rejected; prove actual profiling and complete plans are accepted. Run the repository check and affected browser flows.

## Performance

Profile representative real calls through Harness, retaining latency samples and process memory with explicit attribution. Audit reads and checks evidence; planning audits do not benchmark hypothetical implementations. Keep broad checks sequential and within the project memory target.

## Future Enhancements

- Provider-specific stop adapters can invoke the same audit; an external agent that never enters Harness cannot be prevented from sending an unsupported chat message.
