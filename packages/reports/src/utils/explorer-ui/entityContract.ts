import type { ExplorerCategory } from '../../models/explorer-ui/Explorer.types';

export interface ContractRow {
	label: string;
	value: string;
	/** What each named item is, where the contract says so in words; a derived one does not. */
	items?: Array<{ name: string; text: string }>;
}

export interface ContractFacts {
	category: ExplorerCategory;
	/** The web address of a page; null when the history records none. */
	appRoute?: string | null;
}

export {
	requiredStates,
	entityContract
} from '../../components/explorer-ui/entity-sections/entityContract';

export { humanize } from '../../helpers/explorer-ui/humanize';
