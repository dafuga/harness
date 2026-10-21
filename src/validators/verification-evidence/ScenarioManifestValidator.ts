import {
	scenarioManifestSchema,
	type ScenarioManifest
} from '../../core/development-tooling/unitTypes';
import {
	schemaErrors,
	type ManifestValidation
} from '../development-tooling/ComponentManifestValidator';

/** Wording that admits a state could occur but has no proof yet. */
const unproven = /fixture|not yet|todo|later|no test|unproven|pending|missing|unimplemented/i;

/** Checks one scenario contract: its schema and the honesty of its own declarations. */
export class ScenarioManifestValidator {
	validate(value: unknown, file: string): ManifestValidation<ScenarioManifest> {
		const label =
			file
				.split('/')
				.at(-1)
				?.replace(/\.json$/, '') ?? file;
		const parsed = scenarioManifestSchema.safeParse(value);
		if (!parsed.success) return { errors: schemaErrors(parsed.error, label) };
		const scenario = parsed.data;
		const errors = [
			...(scenario.id === label ? [] : [`${label}: id "${scenario.id}" must match its file name`]),
			...this.undeclaredStates(scenario),
			...this.stateCoverage(scenario),
			...this.stateUnits(scenario),
			...this.evidenceReferences(scenario),
			...this.viewportRules(scenario)
		];
		return { value: scenario, errors };
	}

	/** A state shows only units the scenario covers: it cannot name one from outside it. */
	private stateUnits(scenario: ScenarioManifest): string[] {
		return scenario.states.flatMap((state) =>
			(state.units ?? [])
				.filter((unit) => !scenario.units.includes(unit))
				.map(
					(unit) =>
						`${scenario.id}: state ${state.id} shows ${unit}, which the scenario does not cover`
				)
		);
	}

	/** A state that is not covered must say why instead of silently disappearing. */
	private undeclaredStates(scenario: ScenarioManifest): string[] {
		return scenario.states
			.filter((state) => state.coverage !== 'required' && !state.reason?.trim())
			.map((state) => `${scenario.id}: ${state.coverage} state ${state.id} must give a reason`);
	}

	/**
	 * A state is inapplicable only when it cannot occur; a state nobody has proven yet is
	 * missing. Required states need required evidence, and excluded states need none.
	 */
	private stateCoverage(scenario: ScenarioManifest): string[] {
		const required = scenario.evidence.filter((evidence) => evidence.required);
		return scenario.states.flatMap((state) => {
			const proving = required.filter((evidence) => evidence.states.includes(state.id));
			if (state.coverage === 'required' && proving.length === 0) {
				return [`${scenario.id}: required state ${state.id} has no required evidence`];
			}
			if (state.coverage !== 'inapplicable') return [];
			const excuse = unproven.test(state.reason ?? '')
				? [
						`${scenario.id}: state ${state.id} is called inapplicable, but its reason says it is unproven`
					]
				: [];
			const demanded = proving.map(
				(evidence) =>
					`${scenario.id}: evidence ${evidence.id} requires state ${state.id}, which is declared inapplicable`
			);
			return [...excuse, ...demanded];
		});
	}

	private evidenceReferences(scenario: ScenarioManifest): string[] {
		const states = new Set(scenario.states.map((state) => state.id));
		const viewports = new Set(scenario.viewports.map((viewport) => viewport.id));
		return scenario.evidence.flatMap((evidence) => [
			...evidence.states
				.filter((state) => !states.has(state))
				.map((state) => `${scenario.id}: evidence ${evidence.id} names unknown state ${state}`),
			...evidence.viewports
				.filter((viewport) => !viewports.has(viewport))
				.map((item) => `${scenario.id}: evidence ${evidence.id} names unknown viewport ${item}`),
			...(evidence.kind === 'audio' && !evidence.provenance
				? [`${scenario.id}: audio evidence ${evidence.id} must declare provenance`]
				: [])
		]);
	}

	private viewportRules(scenario: ScenarioManifest): string[] {
		const needsViewports = scenario.evidence.some((evidence) => evidence.kind === 'screenshot');
		if (!needsViewports || scenario.viewports.length > 0) return [];
		return [`${scenario.id}: screenshot evidence requires at least one viewport`];
	}
}
