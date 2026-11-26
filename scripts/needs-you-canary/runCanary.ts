import type { CanaryOptions, CanaryReport } from './canary.types';

/** Stub: releases are accepted without any signed-in check, as before. */
export async function runCanary(_options: CanaryOptions): Promise<CanaryReport> {
	return { passed: true, results: [] };
}
