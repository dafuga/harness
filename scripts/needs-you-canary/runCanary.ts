// @harness-uid u_xzwm43mg2p
import { checkSurface } from './checkSurface';
import { patientTracker } from './patientTracker';
import { recordRelease } from './recordRelease';
import type { CanaryOptions, CanaryReport, CanaryResult, CanarySurface } from './canary.types';

export const canarySurfaces: readonly CanarySurface[] = ['web', 'mac', 'iphone'];

/** Check needs-you on all three production surfaces and record the result on the release item. */
export async function runCanary(given: CanaryOptions): Promise<CanaryReport> {
	const tracker = patientTracker(given.tracker, given.clock, given.log);
	const options = { ...given, tracker };
	// An unknown release item stops the run before any test ask is raised.
	await options.tracker(['show', options.release]);
	const results: CanaryResult[] = [];
	for (const surface of canarySurfaces) {
		const result = await checkSurface(options, surface);
		options.log(`${surface}: ${result.state}: ${result.detail}`);
		results.push(result);
	}
	const report = { passed: results.every((result) => result.state === 'passed'), results };
	await recordRelease(options, report);
	return report;
}
