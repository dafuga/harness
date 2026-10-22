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

/** An identifier of any casing as the words it is made of. */
/** @pure */
export function humanize(name: string): string {
	return name
		.replace(/([a-z0-9])([A-Z])/g, '$1 $2')
		.replace(/([A-Z]+)([A-Z][a-z])/g, '$1 $2')
		.replace(/[_\-.]+/g, ' ')
		.trim()
		.toLowerCase();
}

export {
	requiredStates,
	entityContract
} from '../../components/explorer-ui/harness/entity-sections/entityContract';
