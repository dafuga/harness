// @harness-uid u_k23ebybqw2
import type { VerificationScenarioCoverage } from './verificationScenarioCoverage.types';
import type { VerifyContext } from './VerificationService.types';
import type { ScenarioManifest } from '../../../../core/development-tooling/unitTypes';
import type { Executed } from './SnapshotRunService.types';
import { scenarioCoverage } from './scenarioCoverage';

/** One scenario's authoritative source, reviewer, build and admitted-media inputs. */
export function verificationScenarioCoverage(
	context: VerifyContext,
	scenario: ScenarioManifest,
	executed: Executed,
	deferred = 0
): VerificationScenarioCoverage {
	const own = executed.outcomes.filter((outcome) => outcome.check.scenario === scenario.id);
	const compiled = (executed.builds ?? []).map((build) => [build.id, build.buildId] as const);
	const builds = {
		declared: context.config.builds.map((build) => build.id),
		compiled: new Map(compiled),
		skipped: new Set(executed.skippedBuilds ?? [])
	};
	const coverage = scenarioCoverage({
		scenario,
		commit: context.commit,
		gathered: own.flatMap((outcome) => outcome.gathered),
		checkFailed: own.some((outcome) => !outcome.passed),
		videoSlots: executed.videoSlots?.[scenario.id],
		pendingVideoFlags: executed.pendingVideoFlags?.[scenario.id],
		builds,
		lite: context.verificationProfile === 'lite' ? { deferredChecks: deferred > 0 } : undefined
	});
	return { own, coverage };
}
