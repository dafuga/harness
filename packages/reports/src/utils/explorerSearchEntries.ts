import type { ExplorerEntity } from '../models/Explorer.types';
import type { SearchEntry } from './entitySearch';

/**
 * What the explorer searches of the revision it shows: each entity at that commit with its name,
 * its purpose and the names of its declared contract. What the commit removed is not there to
 * open, and no source path is ever part of an entry.
 */
export function explorerSearchEntries(entities: ExplorerEntity[], commit: string): SearchEntry[] {
	return entities
		.filter((entity) => entity.change !== 'removed')
		.map((entity) => {
			const { inputs, outputs, errors } = entity.unit.contract;
			return {
				id: entity.id,
				category: entity.category,
				name: entity.name,
				purpose: entity.purpose,
				terms: [...inputs, ...outputs, ...errors].map((item) => item.name),
				commit
			};
		});
}
