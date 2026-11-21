// @harness-uid u_tr6ntw6xu2
import type {
	ResourceChoice,
	ResourceHost,
	ResourcePlacementPolicy,
	ResourceReservation,
	ResourceWork
} from '../../../core/execution-runtimes/resourcePlacementTypes';
import { admitResourceHost } from './admitResourceHost';
import { rankResourcePlacement } from './rankResourcePlacement';

/**
 * Chooses the computer for one work request. Ranked candidates are admitted in order; heavy
 * work prefers the primary computer and light work the shared box. Returns the chosen node
 * with its reasons, or null with every blocking reason.
 */
export function chooseResourceHost(input: {
	hosts: ResourceHost[];
	work: ResourceWork;
	reservations: ResourceReservation[];
	policy: ResourcePlacementPolicy;
	now: number;
}): ResourceChoice {
	const { hosts, work, reservations, policy, now } = input;
	const byNode = new Map(hosts.map((host) => [host.node, host]));
	const placement = rankResourcePlacement(hosts, work, policy, now);
	const why: string[] = [];
	let best: { node: string; score: number; reasons: string[] } | null = null;
	for (const candidate of placement.ranked) {
		const host = byNode.get(candidate.node);
		if (!host) continue;
		const blocked = admitResourceHost(host, work, candidate, reservations);
		if (blocked) {
			why.push(`${candidate.node}: ${blocked}`);
			continue;
		}
		const score = candidate.score + preference(host, work);
		if (!best || score > best.score) {
			best = { node: candidate.node, score, reasons: candidate.reasons };
		}
	}
	if (!best) return { node: null, why: why.join('; ') || 'no runner available' };
	return {
		node: best.node,
		why: `${weightOf(work)} ${work.kind}; ${best.reasons.slice(0, 2).join('; ')}`
	};
}

/** Daniel's placement: heavy work on the primary computer, light work on the shared box. */
function preference(host: ResourceHost, work: ResourceWork): number {
	if (work.heavy && host.role === 'primary') return 60;
	if (work.light && host.role === 'shared') return 60;
	return 0;
}

function weightOf(work: ResourceWork): string {
	if (work.heavy) return 'heavy';
	return work.light ? 'light' : 'normal';
}
