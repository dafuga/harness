import type { ExplorerLocation } from '../../../models/explorer-ui/Explorer.types';

/** No helper, section or tab is carried over from the selected route. */
export function permissionProfileLocation(
	route: ExplorerLocation,
	entity?: string
): ExplorerLocation {
	const { branch, commit } = route;
	const to: ExplorerLocation = { branch, commit, category: 'pages', screen: 'permissions' };
	return entity ? { ...to, entity } : to;
}
