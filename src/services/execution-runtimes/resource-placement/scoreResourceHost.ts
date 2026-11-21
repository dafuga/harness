// @harness-uid u_wdyya5bv4x
import { mib, type ResourceSnapshot } from '../../../core/execution-runtimes/resourceTypes';
import type {
	ResourceCandidate,
	ResourceHost,
	ResourceHostClassification,
	ResourceHostRole,
	ResourcePlacementPolicy,
	ResourceWork
} from '../../../core/execution-runtimes/resourcePlacementTypes';

const ROLE_NOTES: Partial<Record<ResourceHostRole, string>> = {
	shared: 'shared by all bots; keeps headroom (at least 4 GB free after the job)',
	runner: 'dedicated runner for Claude tmux sessions and Playwright',
	primary: 'runs Chief of Staff and many Codex sessions'
};

/** Kind-specific preferences per role, with the reason that is shown when one applies. */
const ROLE_PREFERENCES: Array<{
	role: ResourceHostRole;
	kinds: ResourceWork['kind'][];
	bonus: number;
	reason?: (kind: ResourceWork['kind']) => string;
}> = [
	{
		role: 'runner',
		kinds: ['claude', 'browser-tests'],
		bonus: 30,
		reason: (kind) => `preferred for ${kind}`
	},
	{ role: 'runner', kinds: ['build'], bonus: 10 },
	{ role: 'primary', kinds: ['codex'], bonus: 25, reason: () => 'preferred for codex' },
	{
		role: 'primary',
		kinds: ['browser-tests', 'build'],
		bonus: -20,
		reason: (kind) => `avoid heavy ${kind} next to Chief of Staff`
	}
];

/**
 * Scores one computer for one work request, retaining the Tracker's fit rules and score
 * weights. Offline computers never fit; overloaded, or shared-and-busy, computers do not fit.
 */
export function scoreResourceHost(
	host: ResourceHost,
	work: ResourceWork,
	classification: ResourceHostClassification,
	policy: ResourcePlacementPolicy
): ResourceCandidate {
	const note = ROLE_NOTES[host.role];
	const notes = note ? [note] : [];
	const sample = host.snapshot;
	if (classification.status === 'offline' || !sample) {
		const reason = `offline (${classification.reasons[0] ?? 'no sample'})`;
		return candidateOf(host, {
			fits: false,
			score: -Infinity,
			status: 'offline',
			reasons: [...notes, reason]
		});
	}
	const keepMiB = host.role === 'shared' ? policy.keepFreeMiB.shared : policy.keepFreeMiB.default;
	const scoring: {
		host: ResourceHost;
		work: ResourceWork;
		sample: ResourceSnapshot;
		classification: ResourceHostClassification;
		keepMiB: number;
	} = { host, work, sample, classification, keepMiB };
	const fitness = fitnessOf(scoring);
	const preference = scoreOf(scoring);
	return candidateOf(host, {
		fits: fitness.fits,
		score: Math.round(preference.score),
		status: classification.status,
		reasons: [...notes, ...fitness.reasons, ...preference.reasons]
	});
}

function candidateOf(
	host: ResourceHost,
	outcome: Omit<ResourceCandidate, 'node' | 'role'>
): ResourceCandidate {
	return { node: host.node, role: host.role, ...outcome };
}

function fitnessOf(scoring: {
	host: ResourceHost;
	work: ResourceWork;
	sample: ResourceSnapshot;
	classification: ResourceHostClassification;
	keepMiB: number;
}): { fits: boolean; reasons: string[] } {
	const { host, work, sample, classification, keepMiB } = scoring;
	const freeMiB = sample.memoryAvailableBytes / mib;
	const sessions = host.workload.agentSessions;
	const heavy = host.workload.heavyGroups;
	const busyCores = round1(sample.usableCores - sample.cpuAvailableCores);
	const reasons = [
		`${round1(freeMiB / 1024)} GB RAM free, load ${busyCores}/${sample.usableCores} cores, ${sessions} agent session(s)${heavy ? `, ${heavy} test runner/browser group(s)` : ''}`
	];
	let fits = true;
	if (classification.status === 'overloaded') {
		fits = false;
		reasons.push(`overloaded: ${classification.reasons.join('; ')}`);
	}
	const left = freeMiB - work.request.memoryMiB;
	if (left < keepMiB) {
		fits = false;
		reasons.push(
			`would leave ${round1(left / 1024)} GB free (needs ${round1(work.request.memoryMiB / 1024)} GB, keeps ${round1(keepMiB / 1024)} GB)`
		);
	}
	if (host.role === 'shared' && classification.status === 'busy') {
		fits = false;
		reasons.push('shared box is already busy');
	}
	return { fits, reasons };
}

function scoreOf(scoring: {
	host: ResourceHost;
	work: ResourceWork;
	sample: ResourceSnapshot;
	classification: ResourceHostClassification;
	keepMiB: number;
}): { score: number; reasons: string[] } {
	const { host, work, sample, classification, keepMiB } = scoring;
	const idle = sample.cpuAvailableCores / sample.usableCores;
	const freeGB = (sample.memoryAvailableBytes / mib - work.request.memoryMiB - keepMiB) / 1024;
	const ramHead = clamp(freeGB / Math.max(1, sample.memoryTotalBytes / mib / 1024 / 2));
	const sessions = host.workload.agentSessions;
	const heavy = host.workload.heavyGroups;
	const reasons: string[] = [];
	let score = 50 * clamp(idle) + 50 * ramHead - 3 * sessions - 5 * heavy;
	score += roleBonus(host.role, work.kind, reasons);
	if (classification.status === 'busy') score -= 15;
	if (host.role === 'shared') score -= 25; // others' work comes first on the shared box
	return { score, reasons };
}

/** Pushes the matching preference reason and returns its score change. */
function roleBonus(role: ResourceHostRole, kind: ResourceWork['kind'], reasons: string[]): number {
	const rule = ROLE_PREFERENCES.find((r) => r.role === role && r.kinds.includes(kind));
	if (!rule) return 0;
	if (rule.reason) reasons.push(rule.reason(kind));
	return rule.bonus;
}

function clamp(n: number): number {
	return Math.max(0, Math.min(1, n));
}

function round1(n: number): number {
	return Math.round(n * 10) / 10;
}
