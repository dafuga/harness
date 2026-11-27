// @harness-uid u_sbz3zzk4fx
import { checkKey, type SharedCheckCache } from './checkCache';
import { githubCheckProof } from './checkGitHub';
import type { CandidateTree, CheckObservation, CheckPlan, SharedCheck } from './sharedCheck.types';

export function existingProof(cache: SharedCheckCache, candidate: CandidateTree, plan: CheckPlan) {
	const satisfied = new Map<string, CheckObservation>();
	refreshSharedProof(cache, plan.checks, satisfied);
	if (satisfied.size === plan.checks.length) return satisfied;
	const github = githubCheckProof(candidate, plan);
	for (const check of plan.checks) {
		const key = checkKey(check);
		if (!satisfied.has(check.id) && github?.keys.has(key)) {
			satisfied.set(check.id, { id: check.id, key, source: 'github-ci', log: github.url });
		}
	}
	return satisfied;
}

export function refreshSharedProof(
	cache: SharedCheckCache,
	checks: SharedCheck[],
	satisfied: Map<string, CheckObservation>
): void {
	cache.readShared(checks);
	for (const check of checks) {
		const source = cache.source(check);
		if (source && !satisfied.has(check.id))
			satisfied.set(check.id, {
				id: check.id,
				key: checkKey(check),
				source
			});
	}
}
