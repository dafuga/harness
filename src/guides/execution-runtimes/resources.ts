import type { Guide } from '../development-tooling/guide';
export const resourcesGuide: Guide = {
	topic: 'resources',
	summary: 'Coordinate coding, tests and background verification across local Harness sessions.',
	steps: [
		'Inspect harness resources status --json for overall CPU usage, usable cores, available memory and queued reservations.',
		'Queue coding commands with priority coding; agent-needed tests use agent-test and background checks use environment.',
		'Estimate peak additional CPU cores and RAM with --cpus and --memory-mib, or use auto for worker-limited standard commands.',
		'Raise reserves with harness resources configure; defaults are 10% CPU and the larger of 10% RAM or 2048 MiB.'
	],
	rules: [
		'One private SQLite queue coordinates all worktrees using the same HARNESS_RESOURCES_HOME (default ~/.codex/harness/resources).',
		'Admission subtracts reservations as well as observed host load; agent-test precedes coding, then environment, FIFO among eligible requests within each priority; nested work skips blocked ancestor pools so running parents can finish.',
		'A running test finishes under pressure. Later work waits; unavailable, stale or pressured telemetry blocks admission.',
		'Nested commands share a validated bounded parent budget. Standard Vitest workers and Rust/Go/OpenMP/Xcode build workers inherit that budget.',
		'Harness verification checks, loop evaluators, Desktop agent turns and repository build/test/check scripts use admission automatically.',
		'macOS uses VM counters and memory pressure; Linux uses MemAvailable, affinity and cgroup-v2 quotas. Unsupported monitoring fails closed.',
		'Queue waiting defaults to 30 minutes; execution --timeout defaults to six hours. Cancellation cleans owned work only.'
	],
	antiPatterns: [
		'Admission uses resource estimates, not OS hard quotas: external apps and under-estimated commands can still consume the reserve.',
		'Raw commands launched outside Harness are not controlled. Wrap them with resources run; preserve inherited resource context.',
		'Do not suspend running tests, kill unrelated sessions or point each session at a separate queue home.'
	],
	exampleCommands: [
		'harness resources status --json',
		'harness resources run --priority coding --cpus 2 --memory-mib 2048 -- codex exec "Implement the component contract"',
		'harness resources run --priority agent-test --cpus auto --memory-mib auto -- bun run test',
		'harness verify run --priority environment --commit HEAD',
		'harness resources configure --cpu-reserve-percent 15 --memory-reserve-percent 15 --min-memory-reserve-mib 4096'
	]
};
