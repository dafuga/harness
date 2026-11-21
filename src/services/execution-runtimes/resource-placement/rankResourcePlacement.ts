// @harness-uid u_dflfpaat6n
import type {
	ResourceHost,
	ResourcePlacement,
	ResourcePlacementPolicy,
	ResourceWork
} from '../../../core/execution-runtimes/resourcePlacementTypes';
import { classifyResourceHost } from './classifyResourceHost';
import { scoreResourceHost } from './scoreResourceHost';

/**
 * Ranks every computer for one work request: fitting computers first, then by score. The
 * recommendation is the best fitting computer, or null when none fits.
 */
export function rankResourcePlacement(
	hosts: ResourceHost[],
	work: ResourceWork,
	policy: ResourcePlacementPolicy,
	now: number
): ResourcePlacement {
	const ranked = hosts
		.map((host) => scoreResourceHost(host, work, classifyResourceHost(host, policy, now), policy))
		.sort((a, b) => Number(b.fits) - Number(a.fits) || b.score - a.score);
	const best = ranked.find((candidate) => candidate.fits);
	return {
		kind: work.kind,
		needsMemoryMiB: work.request.memoryMiB,
		recommended: best ? best.node : null,
		ranked
	};
}
