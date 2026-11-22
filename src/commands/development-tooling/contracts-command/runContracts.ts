// @harness-uid u_k3ea3edvu7
import { fail } from '../../../core/development-tooling/errors';
import { readContractCatalog } from './readContractCatalog';
import { contractSummary, filterContracts, selectContracts } from './contractSelection';
import { searchContracts } from './searchContracts';
import { mapContracts } from './mapContracts';
import { renderContracts } from './renderContracts';
import type { ContractOptions } from './contracts.types';

/** A fresh in-memory index per command avoids stale disk caches after moves and edits. */
export async function runContracts(
	operation: string,
	query: string,
	options: ContractOptions
): Promise<string> {
	const root = options.root ?? process.cwd();
	const catalog = (
		await readContractCatalog(root, operation === 'show' || operation === 'search')
	).filter((entry) => (options.includeRetired ?? false) || entry.manifest.status === 'active');
	const filtered = filterContracts(catalog, options);
	let result;
	if (operation === 'list') result = filtered.slice(0, options.limit).map(contractSummary);
	else if (operation === 'search') result = searchContracts(filtered, query, options);
	else {
		const matches = selectContracts(filtered, query, root).slice(0, options.limit);
		if (!matches.length) return fail(`No contracts match "${query}".`);
		result =
			operation === 'map' ? mapContracts(catalog, matches, query, options.depth ?? 1) : matches;
	}
	return options.json ? JSON.stringify(result, null, 2) : renderContracts(operation, result);
}
