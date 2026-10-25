import type { ModuleResource } from '../../services/module-system/moduleDefinition.types';
import type { ExplorerLocation } from '../../utils/explorerRoute';
/** @pure Resolve a declared resource destination while retaining only revision scope. */
export function moduleResourceLocation(
	scope: Pick<ExplorerLocation, 'branch' | 'commit'>,
	module: string,
	resource: ModuleResource
): ExplorerLocation {
	const { branch, commit } = scope;
	const category = resource.catalog;
	if (category === 'styles' || category === 'dependencies')
		return { branch, commit, category: 'pages', screen: category };
	if (category) return { branch, commit, category };
	return {
		branch,
		commit,
		category: 'pages',
		screen: 'module-resources',
		entity: `${module}.${resource.id}`
	};
}
