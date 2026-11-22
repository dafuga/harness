import type { ContractEntry } from '../../src/commands/development-tooling/contracts-command/contracts.types';
import { contractUnit } from '../support/contractsProject';

/**
 * mapContracts stores nothing, so no temporary directory is needed: the examples pass it catalog
 * entries built in memory, with manifests parsed by the schema the catalog reader uses. Each map is
 * compared by the ids its lists hold, beside its query label and its unresolved ids.
 */

/** A catalog entry as readContractCatalog builds one, with the units its manifest depends on. */
export function entry(id: string, dependsOn: string[] = []): ContractEntry {
	const manifest = contractUnit(id, `src/${id}.ts`, dependsOn);
	return {
		id,
		kind: manifest.kind,
		title: manifest.title,
		path: manifest.owns.source[0],
		contractPath: `specification/units/${id}.json`,
		responsibility: manifest.responsibility,
		manifest,
		states: []
	};
}
