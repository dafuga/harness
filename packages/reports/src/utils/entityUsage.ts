import type { ExplorerEntity, ExplorerRelations, ExplorerSupport } from '../models/Explorer.types';
import { categoryIcon, type HarnessIconName } from './harnessIcons';

/** One kind of thing an entity uses, with the entities of that kind. */
export interface UsageGroup {
	title: string;
	icon: HarnessIconName;
	items: ExplorerEntity[];
}

/** What an entity is shown with of the things around it, one list for each direction. */
export interface EntityUsage {
	/** What uses it: the pages that show it first, then everything else, each once. */
	usedIn: ExplorerEntity[];
	/** What it uses, kind by kind; a kind it uses nothing of is left out. */
	uses: UsageGroup[];
	/** What it uses that is none of the five kinds. */
	other: ExplorerSupport[];
	/** How many things it uses in all. */
	count: number;
}

const kinds = [
	['Components', 'components'],
	['Functions', 'functions'],
	['Configs', 'configs'],
	['Services', 'services']
] as const;

/** Each of them once, where it was first named. */
const once = <Item extends { id: string }>(items: Item[]): Item[] => [
	...new Map(items.map((item) => [item.id, item] as const)).values()
];

/**
 * The relations of an entity as its two sections list them. Nothing is worked out again: the
 * pages and the other users become one list, and what it uses stays apart by kind.
 */
export function entityUsage(relations: ExplorerRelations): EntityUsage {
	const uses = kinds
		.map(([title, kind]) => ({ title, icon: categoryIcon[kind], items: once(relations[kind]) }))
		.filter((group) => group.items.length > 0);
	const other = once(relations.support);
	const listed = uses.reduce((sum, group) => sum + group.items.length, 0);
	return {
		usedIn: once([...relations.pages, ...relations.usedBy]),
		uses,
		other,
		count: listed + other.length
	};
}
