# Feature: CPU and memory admission queue

## Overview

Coordinate coding and verification across local Harness sessions without saturating Daniel's laptop. Poll overall CPU availability, logical/usable cores, memory availability and memory pressure. Keep current tests running when pressure rises and hold subsequent work.

## Acceptance Criteria

- Reserve at least 10% usable CPU capacity and max(10% RAM, 2048 MiB); configuration may raise either reserve.
- Atomically coordinate reservations across processes and worktrees through one private shared queue.
- Prioritize agent-needed tests, then coding work, then environment checks; preserve FIFO within each priority.
- Retain reservations in addition to observed host load and bound concurrent nested work to its validated parent budget.
- Preserve forward progress for eligible descendants under saturated ancestor budgets; prioritize runnable work and retain FIFO within each parent pool.
- Fail closed for unavailable, invalid or stale telemetry; reject impossible requests; cancel queued work without launching it.
- Monitor running work, finish the current test under pressure, then hold later work until headroom recovers.
- Integrate verification checks, loop evaluators, Desktop coding turns and repository build/test/check commands; propagate worker budgets and preserve command stdio.
- Reclaim stale requests only after checking PID/start identity; retain live orphan worker reservations.
- Provide status/configure/run CLI, public Node/Bun resource API and guidance explaining admission estimates and unmanaged command boundaries.
- Prove policy, cancellation, pressure, nested concurrency, cross-process ordering, native stdio and both provider integrations with focused tests; run normal project verification remotely to avoid laptop load.

## Future Enhancements

- OS-level quotas and measured peak resource profiles for custom tools.
- Shared resource dashboards and cgroup-v1/Windows process ownership support.
