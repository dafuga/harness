import { createHash } from 'node:crypto';
import { roundsProtocol, warmupCalls, type Comparison } from '../../core/comparisonTypes';
import { canonicalJson } from '../canonicalJson';

/** Fingerprint of a complete request; equal requests hash equally whatever their key order. */
export function requestDigest(request: unknown): string {
	return createHash('sha256').update(canonicalJson(request)).digest('hex');
}

/**
 * The comparison context of Harness's own benchmark, derived from the request it actually sends
 * and the sampling it actually uses rather than from the workload's name.
 */
export function comparisonContext(
	request: unknown,
	sampling: { rounds: number; iterations: number }
): Comparison {
	return {
		request: requestDigest(request),
		boundary: 'public-invocation',
		protocol: roundsProtocol,
		sampling: { warmup: warmupCalls, rounds: sampling.rounds, iterations: sampling.iterations }
	};
}
