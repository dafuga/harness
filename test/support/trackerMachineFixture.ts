import type { TrackerResourceSample } from '../../src/utils/projects-sessions/trackerMachine.types';

/** An idle computer; each test overrides the readings it cares about. */
export function resourceSample(
	at: number,
	over: Partial<TrackerResourceSample> = {}
): TrackerResourceSample {
	return {
		at: new Date(at).toISOString(),
		platform: 'darwin',
		cores: 10,
		load: [1, 1, 1],
		cpu_busy_pct: 5,
		ram: { total_mb: 65_536, used_mb: 16_384, available_mb: 49_152, available_pct: 75 },
		swap: { total_mb: 2048, used_mb: 100 },
		disks: [{ mount: '/System/Volumes/Data', total_gb: 900, free_gb: 300, free_pct: 33 }],
		agents: { claude: 0, codex: 0, test_runners: 0, browsers: 0 },
		top_cpu: [],
		top_rss: [],
		...over
	};
}

export function runnerReport(at: number, projects: string[], freeSlots = 2) {
	const stamp = new Date(at).toISOString();
	return {
		enabled: true,
		last_tick_at: stamp,
		last_error: null,
		capacity: {
			freeSlots,
			projects: Object.fromEntries(projects.map((name) => [name, { freeGB: 200, freePct: 40 }]))
		}
	};
}
