// @harness-uid u_47p4ljwkx5
import {
	trackerActualUtilization,
	trackerBusyLoadPerCore,
	trackerMacRole,
	trackerSessionOverload,
	trackerUtilizationTargets
} from './trackerMachineStatus';
import type {
	TrackerMachineRow,
	TrackerPlacement,
	TrackerPlacementCandidate,
	TrackerPlacementRequest,
	TrackerProcessGroup,
	TrackerResourceSample,
	TrackerWorkKind,
	TrackerWorkDemand
} from './trackerMachine.types';

export const trackerWorkRamGB: Record<TrackerWorkKind, number> = {
	codex: 1.5,
	claude: 2,
	'browser-tests': 4,
	build: 4,
	general: 2
};

const estimatedCores: Record<TrackerWorkKind, number> = {
	codex: 0.25,
	claude: 0.25,
	'browser-tests': 4,
	build: 5,
	general: 0.25
};

const noWork = { cores: 0, ramGB: 0 };

/** Use the upper quartile of distinct observed process-group peaks, with cold-start defaults. */
export function trackerObservedDemand(
	kind: TrackerWorkKind,
	history: readonly TrackerResourceSample[]
): TrackerWorkDemand {
	const fallback = { cores: estimatedCores[kind], ramGB: trackerWorkRamGB[kind] };
	const peaks = new Map<string, TrackerWorkDemand>();
	for (const sample of history) {
		for (const group of [...sample.top_cpu, ...sample.top_rss]) {
			if (!matchesObservedKind(group, kind)) continue;
			const old = peaks.get(group.label) ?? noWork;
			peaks.set(group.label, {
				cores: Math.max(old.cores, group.cpu / 100),
				ramGB: Math.max(old.ramGB, group.rss_mb / 1024)
			});
		}
	}
	if (peaks.size < 3) return fallback;
	const observations = [...peaks.values()];
	const quartile = (key: keyof TrackerWorkDemand) =>
		observations.map((sample) => sample[key]).sort((a, b) => a - b)[
			Math.floor(observations.length * 0.75)
		];
	return { cores: Math.max(0.1, quartile('cores')), ramGB: Math.max(0.5, quartile('ramGB')) };
}

function matchesObservedKind(group: TrackerProcessGroup, kind: TrackerWorkKind): boolean {
	const heavy = group.kind === 'test-runner' || group.kind === 'browser';
	if (kind === 'browser-tests' || kind === 'build') return heavy;
	return !heavy && group.cpu <= 75 && group.rss_mb <= 2560;
}

/** Rank computers for new work; the first one that fits is the recommendation. */
export function placeTrackerWork(
	rows: readonly TrackerMachineRow[],
	request: TrackerPlacementRequest = {}
): TrackerPlacement {
	const { kind = 'general', needsRamGB, needsCores, exclude = [] } = request;
	const demand = {
		cores: needsCores ?? estimatedCores[kind],
		ramGB: needsRamGB ?? trackerWorkRamGB[kind]
	};
	const ranked = rows
		.filter(({ node }) => !exclude.includes(node))
		.map((row) => candidate(row, demand, request))
		.sort(
			(left, right) =>
				Number(right.fits) - Number(left.fits) ||
				(right.score ?? -Infinity) - (left.score ?? -Infinity)
		);
	const best = ranked.find(({ fits }) => fits);
	return {
		kind,
		needs_ram_gb: demand.ramGB,
		needs_cores: demand.cores,
		recommended: best?.node ?? null,
		ranked
	};
}

function candidate(
	row: TrackerMachineRow,
	demand: TrackerWorkDemand,
	request: TrackerPlacementRequest
): TrackerPlacementCandidate {
	const { node, role, status, sample } = row;
	if (status === 'offline' || !sample)
		return { node, role, status, fits: false, score: null, reasons: row.reasons };
	const { kind, sessionSlots, reserved } = request;
	const slots = sessionSlots && (sessionSlots.get(node) ?? 0);
	const free = placementHeadroom(
		sample,
		placementCapacity(row, sample),
		reserved?.get(node) ?? noWork
	);
	const holds = fitHolds(row, sample, {
		demand,
		free,
		agentSession: isAgentSession(request),
		slots
	});
	const cpuHeavy = kind === 'browser-tests' || kind === 'build';
	const score =
		matchScore(demand, free, sample, { cpuHeavy, slots }) - (role === 'shared' ? 25 : 0);
	const slotSummary = slots === undefined ? '' : `, ${slots} session slot(s) free`;
	const estimate = `needs ${demand.cores.toFixed(2)} cores and ${demand.ramGB.toFixed(2)} GB RAM; ${Math.max(0, free.cores).toFixed(1)} cores and ${Math.max(0, free.ramGB).toFixed(1)} GB under targets${slotSummary}`;
	return {
		node,
		role,
		status,
		fits: !holds.length,
		score: Math.round(score),
		reasons: [summary(sample), estimate, ...holds]
	};
}

function isAgentSession({ kind, agentSession }: TrackerPlacementRequest): boolean {
	return agentSession ?? (kind === 'codex' || kind === 'claude');
}

function placementCapacity(
	row: TrackerMachineRow,
	sample: TrackerResourceSample
): TrackerWorkDemand {
	const totalGB = sample.ram.total_mb / 1024;
	const ramGB = trackerMacRole(row.role)
		? totalGB * (trackerUtilizationTargets.ram / 100)
		: Math.min(
				totalGB * (trackerUtilizationTargets.ram / 100),
				totalGB - (row.role === 'shared' ? 4 : 2)
			);
	return { cores: sample.cores * (trackerUtilizationTargets.cpu / 100), ramGB };
}

export function trackerMachineTargets(row: TrackerMachineRow, sample: TrackerResourceSample) {
	const limits = placementCapacity(row, sample);
	const ram = Math.round((100 * limits.ramGB * 1024) / sample.ram.total_mb);
	return { cpu: trackerUtilizationTargets.cpu, ram: Math.min(100, Math.max(0, ram)) };
}

function placementHeadroom(
	sample: TrackerResourceSample,
	limits: TrackerWorkDemand,
	reserved: TrackerWorkDemand
) {
	const usage = trackerActualUtilization(sample);
	const busyCores = usage.cpu === null ? (sample.load[1] ?? 0) : (usage.cpu * sample.cores) / 100;
	return {
		cores: limits.cores - busyCores - reserved.cores,
		ramGB: limits.ramGB - (usage.ram * sample.ram.total_mb) / (100 * 1024) - reserved.ramGB
	};
}

function fitHolds(
	row: TrackerMachineRow,
	sample: TrackerResourceSample,
	{
		demand,
		free,
		agentSession,
		slots
	}: {
		demand: TrackerWorkDemand;
		free: TrackerWorkDemand;
		agentSession: boolean;
		slots?: number;
	}
): string[] {
	const holds: string[] = [];
	const overload = agentSession ? trackerSessionOverload(row) : row.status === 'overloaded';
	if (overload) holds.push(`overloaded: ${row.reasons.join('; ')}`);
	if (free.ramGB < demand.ramGB) holds.push('insufficient RAM below the utilisation target');
	if (!agentSession && free.cores < demand.cores)
		holds.push('insufficient free cores below the utilisation target');
	if (row.role === 'shared' && (sample.load[1] ?? 0) > trackerBusyLoadPerCore * sample.cores)
		holds.push('shared box is already busy');
	if (slots === 0) holds.push('no available launcher session slot');
	return holds;
}

function matchScore(
	demand: TrackerWorkDemand,
	free: TrackerWorkDemand,
	sample: TrackerResourceSample,
	{ cpuHeavy, slots = Infinity }: { cpuHeavy: boolean; slots?: number }
): number {
	const coresPerGB = (sample.cores * 1024) / sample.ram.total_mb;
	const capacity = cpuHeavy
		? free.cores / demand.cores
		: Math.min(free.ramGB / demand.ramGB, slots);
	const affinity = cpuHeavy ? Math.log2(coresPerGB) : -Math.log2(coresPerGB);
	const cpuPressure = Math.max(0, -free.cores) / sample.cores;
	// Compare how many jobs fit on the limiting resource, with diminishing returns.
	return 20 * Math.log2(1 + Math.max(0, capacity)) + 10 * affinity - 40 * cpuPressure;
}

function summary(sample: TrackerResourceSample): string {
	const { claude, codex, test_runners, browsers } = sample.agents;
	const heavy = test_runners + browsers;
	const extra = heavy ? `, ${heavy} test runner/browser group(s)` : '';
	return `${Math.round((sample.ram.available_mb / 1024) * 10) / 10} GB RAM free, load ${sample.load[1] ?? 0}/${sample.cores} cores, ${claude + codex} agent session(s)${extra}`;
}
