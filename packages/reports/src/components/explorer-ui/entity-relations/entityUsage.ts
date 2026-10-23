import type { EntityUsage } from '../../../utils/explorer-ui/entityUsage';
import type { ExplorerEntity, ExplorerRelations } from '../../../models/explorer-ui/Explorer.types';
import { categoryIcon } from '../../../utils/explorer-ui/harnessIcons';

const kinds = [
	['Pages', 'pages'],
	['Layouts', 'layouts'],
	['Components', 'components'],
	['Functions', 'functions'],
	['Configs', 'configs'],
	['Services', 'services'],
	['Models', 'models'],
	['Types', 'types']
] as const;

/** Each of them once, where it was first named. */
const once = <Item extends { id: string }>(items: Item[]): Item[] => [
	...new Map(items.map((item) => [item.id, item] as const)).values()
];

/** Distinct consumers grouped by their declared module type, in navigation order. */
export function usageGroups(items: ExplorerEntity[]) {
	return kinds
		.map(([title, kind]) => ({
			title,
			icon: categoryIcon[kind],
			items: once(items.filter((item) => item.category === kind))
		}))
		.filter((group) => group.items.length > 0);
}

/**
 * The relations of an entity as its two sections list them. Nothing is worked out again: the
 * users and dependencies each stay apart by kind.
 */
export function entityUsage(relations: ExplorerRelations): EntityUsage {
	const usedIn = once([...relations.pages, ...relations.usedBy]);
	const uses = kinds
		.filter(([, kind]) => kind !== 'pages')
		.map(([title, kind]) => ({
			title,
			icon: categoryIcon[kind],
			items: once(relations[kind] ?? [])
		}))
		.filter((group) => group.items.length > 0);
	const other = once(relations.support);
	const listed = uses.reduce((sum, group) => sum + group.items.length, 0);
	return {
		usedIn,
		usedInGroups: usageGroups(usedIn),
		uses,
		other,
		count: listed + other.length
	};
}
