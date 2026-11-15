// @harness-uid u_kfhycvgnnp
import type { ScenarioManifest } from '../../../../core/development-tooling/unitTypes';
import type { VerifyConfig } from '../../../../core/verification-evidence/verifyTypes';

/**
 * Declared scenario builds take precedence; otherwise uses evidence build ids, or `'all'` when a
 * scenario has no evidence or some evidence item names no build.
 */
export function neededBuilds(scenarios: ScenarioManifest[]): Set<string> | 'all' {
	const builds = new Set<string>();
	for (const scenario of scenarios) {
		if (scenario.builds !== undefined) {
			for (const build of scenario.builds) builds.add(build);
			continue;
		}
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
