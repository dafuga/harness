import { resolve } from 'node:path';
import { WorkingTreeAdapter } from '../../adapters/git-source-history/WorkingTreeAdapter';
import { fail } from '../../core/development-tooling/errors';
import type { ScenarioManifest } from '../../core/development-tooling/unitTypes';
import { ScenarioRepository } from '../../repositories/verification-evidence/ScenarioRepository';
import { UnitRegistryRepository } from '../../repositories/verification-evidence/UnitRegistryRepository';
import {
	scenarioRequirements,
	type ScenarioRequirements
} from '../../utils/verification-evidence/scenarioRequirements';

async function load(root = process.cwd()) {
	const absolute = resolve(root);
	const tree = new WorkingTreeAdapter(absolute);
	const scenarios = await new ScenarioRepository(absolute).read(tree);
	const units = await new UnitRegistryRepository(absolute).read(tree);
	return { scenarios, units: new Set(units.manifests.map((unit) => unit.id)) };
}

export async function listScenarios(root?: string) {
	const { scenarios } = await load(root);
	return scenarios.manifests
		.map((scenario) => ({
			id: scenario.id,
			kind: scenario.kind,
			title: scenario.title,
			units: scenario.units,
			...summary(scenarioRequirements(scenario))
		}))
		.sort((left, right) => (left.id < right.id ? -1 : 1));
}

function summary(requirements: ScenarioRequirements) {
	return {
		captures: requirements.required.length,
		unproven: requirements.unproven.length,
		excluded: requirements.excluded.length
	};
}

export async function showScenario(
	id: string,
	root?: string
): Promise<ScenarioRequirements & { scenario: ScenarioManifest }> {
	const { scenarios } = await load(root);
	const scenario = scenarios.manifests.find((item) => item.id === id);
	if (!scenario) return fail(`Unknown scenario "${id}".`);
	return { scenario, ...scenarioRequirements(scenario) };
}

/** Schema and honesty problems in scenario contracts, plus references to unknown units. */
export async function checkScenarios(
	root?: string
): Promise<{ scenarios: number; errors: string[] }> {
	const { scenarios, units } = await load(root);
	const unknown = scenarios.manifests.flatMap((scenario) =>
		scenario.units
			.filter((unit) => !units.has(unit))
			.map((unit) => `${scenario.id} covers unknown unit ${unit}`)
	);
	return { scenarios: scenarios.manifests.length, errors: [...scenarios.errors, ...unknown] };
}
