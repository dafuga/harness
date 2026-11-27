// @harness-uid u_47p4ljwkx5
import type { TrackerWorkPreference } from './placeTrackerWork.types';
import { trackerBusyLoadPerCore } from './trackerMachineStatus';
import type {
	TrackerMachineRole,
	TrackerMachineRow,
	TrackerPlacement,
	TrackerPlacementCandidate,
	TrackerPlacementRequest,
	TrackerResourceSample,
	TrackerWorkKind
} from './trackerMachine.types';

/** Typical RAM that new work needs, in GB. */
export const trackerWorkRamGB: Record<TrackerWorkKind, number> = {
	codex: 1.5,
	claude: 2,
	'browser-tests': 4,
	build: 4,
	general: 2
};

const roleNotes: Record<TrackerMachineRole, string | null> = {
	shared: 'shared by all bots; keeps headroom (at least 4 GB free after the job)',
	runner: 'dedicated runner for Claude tmux sessions and Playwright',
	primary: 'runs Chief of Staff and many Codex sessions',
	other: null
};

const preferences: Partial<
	Record<TrackerMachineRole, Partial<Record<TrackerWorkKind, TrackerWorkPreference>>>
> = {
	runner: {
		claude: { score: 30, reason: 'preferred for claude' },
		'browser-tests': { score: 30, reason: 'preferred for browser-tests' },
		build: { score: 10 }
	},
	primary: {
		codex: { score: 25, reason: 'preferred for codex' },
		'browser-tests': { score: -20, reason: 'avoid heavy browser-tests next to Chief of Staff' },
		build: { score: -20, reason: 'avoid heavy build next to Chief of Staff' }
	}
};

/** Rank computers for new work; the first one that fits is the recommendation. */
export function placeTrackerWork(
	rows: readonly TrackerMachineRow[],
	request: TrackerPlacementRequest = {}
): TrackerPlacement {
	const { kind = 'general', needsRamGB, exclude = [] } = request;
	const need = needsRamGB ?? trackerWorkRamGB[kind];
	const ranked = rows
		.filter(({ node }) => !exclude.includes(node))
		.map((row) => candidate(row, kind, need))
		.sort(
			(left, right) =>
				Number(right.fits) - Number(left.fits) ||
				(right.score ?? -Infinity) - (left.score ?? -Infinity)
		);
	const best = ranked.find(({ fits }) => fits);
	return { kind, needs_ram_gb: need, recommended: best?.node ?? null, ranked };
}

function candidate(
	row: TrackerMachineRow,
	kind: TrackerWorkKind,
	need: number
): TrackerPlacementCandidate {
	const { node, role, status, sample } = row;
	const note = roleNotes[role];
	const notes = note ? [note] : [];
	if (status === 'offline' || !sample)
		return {
			node,
			role,
			status,
			fits: false,
			score: null,
			reasons: [...notes, `offline (${row.reasons[0] ?? 'no sample'})`]
		};
	const holds = fitHolds(row, sample, need);
	const preference = preferences[role]?.[kind];
	const reasons = [...notes, summary(sample), ...holds];
	if (preference?.reason) reasons.push(preference.reason);
	const score = headroom(row, sample, need) + (preference?.score ?? 0);
	return { node, role, status, fits: !holds.length, score: Math.round(score), reasons };
}

function fitHolds(row: TrackerMachineRow, sample: TrackerResourceSample, need: number): string[] {
	const holds: string[] = [];
	const free = sample.ram.available_mb / 1024;
	const keep = keepFreeGB(row.role);
	if (row.status === 'overloaded') holds.push(`overloaded: ${row.reasons.join('; ')}`);
	if (free - need < keep)
		holds.push(`would leave ${round(free - need)} GB free (needs ${need} GB, keeps ${keep} GB)`);
	if (row.role === 'shared' && (sample.load[1] ?? 0) > trackerBusyLoadPerCore * sample.cores)
		holds.push('shared box is already busy');
	return holds;
}

function headroom(row: TrackerMachineRow, sample: TrackerResourceSample, need: number): number {
	const busyLoad = trackerBusyLoadPerCore * sample.cores;
	const cpu = clamp((busyLoad - (sample.load[1] ?? 0)) / busyLoad);
	const spare = sample.ram.available_mb / 1024 - need - keepFreeGB(row.role);
	const ram = clamp(spare / Math.max(1, sample.ram.total_mb / 1024 / 2));
	const { claude, codex, test_runners, browsers } = sample.agents;
	let score = 50 * cpu + 50 * ram - 3 * (claude + codex) - 5 * (test_runners + browsers);
	if (row.status === 'busy') score -= 15;
	// Other bots' work comes first on the shared box.
	if (row.role === 'shared') score -= 25;
	return score;
}

function keepFreeGB(role: TrackerMachineRole): number {
	return role === 'shared' ? 4 : 2;
}

function summary(sample: TrackerResourceSample): string {
	const { claude, codex, test_runners, browsers } = sample.agents;
	const heavy = test_runners + browsers;
	const extra = heavy ? `, ${heavy} test runner/browser group(s)` : '';
	return `${round(sample.ram.available_mb / 1024)} GB RAM free, load ${sample.load[1] ?? 0}/${sample.cores} cores, ${claude + codex} agent session(s)${extra}`;
}

function clamp(value: number): number {
	return Math.max(0, Math.min(1, value));
}

function round(value: number): number {
	return Math.round(value * 10) / 10;
}
