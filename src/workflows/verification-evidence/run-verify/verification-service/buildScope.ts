// @harness-uid u_kfhycvgnnp
import type { ScenarioManifest } from '../../../../core/development-tooling/unitTypes';
import type { VerifyConfig } from '../../../../core/verification-evidence/verifyTypes';

/**
 * The build ids the scenarios' evidence names, or `'all'` when some scenario may use any build:
 * it has no evidence, or one of its evidence items names no build.
 */
export function neededBuilds(scenarios: ScenarioManifest[]): Set<string> | 'all' {
	const builds = new Set<string>();
	for (const scenario of scenarios) {
		const evidence = scenario.evidence ?? [];
		if (evidence.length === 0) return 'all';
		for (const item of evidence) {
			if (!item.build) return 'all';
			builds.add(item.build);
		}
	}
	return builds;
}

/**
 * The setup steps to run, in order: every step that names no build, every step that names a
 * needed build, and every step when `needed` is `'all'`. An empty `builds` list names no build.
 */
export function scopedSetup(
	setup: VerifyConfig['setup'],
	needed: ReadonlySet<string> | 'all'
): VerifyConfig['setup'] {
	if (needed === 'all') return [...setup];
	return setup.filter((step) => {
		const builds = step.builds ?? [];
		return builds.length === 0 || builds.some((id) => needed.has(id));
	});
}
