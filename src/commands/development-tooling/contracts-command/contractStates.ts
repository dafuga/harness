// @harness-uid u_hf5ptnnuk7
import { join, relative, resolve } from 'node:path';
import { scenariosDirectory } from '../../../core/development-tooling/unitsConfig';
import { scenarioManifestSchema } from '../../../core/development-tooling/unitTypes';
import { fail } from '../../../core/development-tooling/errors';
import { contractFiles, readContractJson } from './contractDocuments';
import type { ContractEntry } from './contracts.types';

/** Attach declared state metadata from stored scenario contracts, never executable catalogs. */
export async function attachContractStates(entries: ContractEntry[], root: string): Promise<void> {
	const paths = await contractFiles(join(resolve(root), scenariosDirectory));
	const byUnit = new Map(entries.map((entry) => [entry.id, entry]));
	const byScenario = scenarioOwners(entries);
	for (const path of paths) {
		const label = relative(resolve(root), path);
		const checked = scenarioManifestSchema.safeParse(await readContractJson(path, label));
		if (!checked.success)
			fail(`Invalid scenario contract ${label}: ${checked.error.issues[0].message}`);
		const scenario = checked.data;
		const owners = new Set([
			...scenario.units.flatMap((id) => byUnit.get(id) ?? []),
			...(byScenario.get(scenario.id) ?? [])
		]);
		for (const state of scenario.states)
			for (const entry of owners) {
				if (state.units && !state.units.includes(entry.id)) continue;
				entry.states.push({ scenario: scenario.id, ...state });
			}
	}
}

function scenarioOwners(entries: ContractEntry[]): Map<string, ContractEntry[]> {
	const byScenario = new Map<string, ContractEntry[]>();
	for (const entry of entries)
		for (const id of entry.manifest.scenarios) {
			const owners = byScenario.get(id) ?? [];
			owners.push(entry);
			byScenario.set(id, owners);
		}
	return byScenario;
}
