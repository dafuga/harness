import type { EntityUsage } from '../../../../utils/explorer-ui/entityUsage';
import type { ExplorerRelations } from '../../../../models/explorer-ui/Explorer.types';
import { categoryIcon } from '../../../../utils/explorer-ui/harnessIcons';

const kinds = [
	['Shells', 'shells'],
	['Components', 'components'],
	['Functions', 'functions'],
	['Configs', 'configs'],
	['Services', 'services'],
	['Models', 'models']
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
		.map(([title, kind]) => ({
			title,
			icon: categoryIcon[kind],
			items: once(relations[kind] ?? [])
		}))
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
