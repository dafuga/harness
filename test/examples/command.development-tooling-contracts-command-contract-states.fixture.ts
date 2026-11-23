import type { ContractEntry } from '../../src/commands/development-tooling/contracts-command/contracts.types';

/** A stored entry as readContractCatalog builds it: the parsed manifest and no states yet. */
export function storedEntry(id: string, scenarioIds: string[] = []): ContractEntry {
	const source = `src/${id}.ts`;
	const manifest: ContractEntry['manifest'] = {
		schemaVersion: 1,
		id,
		kind: 'command',
		title: id,
		responsibility: `Example unit ${id}.`,
		responsibilityOrigin: 'declared',
		status: 'active',
		owns: { source: [source], symbols: [] },
		contract: { origin: 'declared', inputs: [], outputs: [], errors: [], errorStatus: 'declared' },
		dependencies: [],
		runtime: { kind: 'module', entry: source, targets: [{ kind: 'module', entry: source }] },
		scenarios: scenarioIds,
		budgets: { size: 'frozen', complexity: 'frozen', performance: [] }
	};
	return {
		id,
		kind: 'command',
		title: id,
		path: source,
		contractPath: `specification/units/${id}.json`,
		responsibility: manifest.responsibility,
		manifest,
		states: []
	};
}
