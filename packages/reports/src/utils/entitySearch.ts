import { type ExplorerCategory } from '../../../../src/utils/explorerRoute';

/** What one entity of one revision offers to be searched: never a source path. */
export interface SearchEntry {
	id: string;
	category: ExplorerCategory;
	/** The display name a reader knows it by. */
	name: string;
	purpose: string;
	/** The names of its declared contract inputs, outputs and errors, where the host has them. */
	terms: string[];
	/** The full commit the entry was read at; a result keeps it. */
	commit: string;
}

export { entitySearch } from '../components/entity-search/entitySearch';
