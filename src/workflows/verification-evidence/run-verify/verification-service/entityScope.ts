import type { ScenarioManifest } from '../../../../core/development-tooling/unitTypes';
import type { PlannedCheck } from '../../../../utils/verification-evidence/verifyPlan';
import { fail } from '../../../../core/development-tooling/errors';

/** The statement every scoped record carries, so it is never read as a full pass. */
export function scopeFailure(entity: string): string {
	return `Scoped to ${entity}: only its scenario states ran, so this record is partial and never a full pass.`;
}

/**
 * The scenarios that cover one entity, each narrowed to the states that show it, so its coverage
 * asks only for that entity's captures. An entity no scenario covers is refused.
 */
export function scopedScenarios(scenarios: ScenarioManifest[], entity: string): ScenarioManifest[] {
	const covering = scenarios.filter((scenario) => scenario.units.includes(entity));
	if (covering.length === 0) fail(`No scenario covers ${entity}; nothing can be verified for it.`);
	return covering.map((scenario) => {
		const states = scenario.states.filter((state) => (state.units ?? []).includes(entity));
		const shown = new Set(states.map((state) => state.id));
		return {
			...scenario,
			units: [entity],
			states,
			evidence: (scenario.evidence ?? []).map((item) => ({
				...item,
				states: item.states.filter((state) => shown.has(state))
			}))
		};
	});
}

const escaped = (value: string) => value.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');

/** A Playwright check limited to the tests named after the entity, at every viewport and variant. */
export function scopedCheck(check: PlannedCheck, entity: string): PlannedCheck {
	const playwright = check.runner === 'playwright' || /\bplaywright test\b/.test(check.command);
	if (!playwright) return check;
	const grep = `(^| )${escaped(entity)}(:[^ ]+)? at `;
	return { ...check, command: `${check.command} --grep '${grep}'` };
}
