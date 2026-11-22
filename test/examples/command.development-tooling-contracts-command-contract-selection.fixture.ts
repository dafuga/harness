import type { Status } from './command.development-tooling-contracts-command-contract-selection.test.types';
import type { ComponentManifest } from '../../src/core/development-tooling/unitTypes';

/** A stored record as readContractCatalog builds it; the kind is the id's first segment. */
export function contract(id: string, source: string[], title: string, status: Status = 'active') {
	const kind = id.split('.')[0];
	const responsibility = `Example responsibility for ${id}.`;
	const manifest: ComponentManifest = {
		schemaVersion: 1,
		id,
		kind,
		title,
		responsibility,
		responsibilityOrigin: 'declared',
		status,
		owns: { source, symbols: [] },
		contract: { origin: 'declared', inputs: [], outputs: [], errors: [] },
		dependencies: [],
		runtime: { kind: 'module', entry: source[0], targets: [{ kind: 'module', entry: source[0] }] },
		scenarios: [],
		budgets: { size: 'frozen', complexity: 'frozen', performance: [] }
	};
	const contractFile = `specification/units/${id}.json`;
	return {
		id,
		kind,
		title,
		path: source[0],
		contractPath: contractFile,
		responsibility,
		manifest,
		states: []
	};
}
