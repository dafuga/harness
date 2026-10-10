import { scenarioManifestSchema, type ScenarioManifest } from '../core/unitTypes';
import { schemaErrors, type ManifestValidation } from './ComponentManifestValidator';

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
			...this.evidenceReferences(scenario),
			...this.viewportRules(scenario)
		];
		return { value: scenario, errors };
	}

	/** A state that is not covered must say why instead of silently disappearing. */
	private undeclaredStates(scenario: ScenarioManifest): string[] {
		return scenario.states
			.filter((state) => state.coverage !== 'required' && !state.reason?.trim())
			.map((state) => `${scenario.id}: ${state.coverage} state ${state.id} must give a reason`);
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
