import type { ConsoleRoute } from "../consoleRoute";
import { explorerKindCategory, type ExplorerLocation } from "../explorerRoute";

/**
 * The category the id of a unit names: its kind is the part before its name. An id that names
 * none is looked for among the functions, where the explorer says so if it is not one.
 */
function categoryOf(unit: string): ExplorerLocation['category'] {
	const parts = unit.split('.');
	return explorerKindCategory(parts[parts.length - 2] ?? '') ?? 'functions';
}

/**
 * The explorer address an earlier console page stands for, at the commit it named. A page with
 * a selected unit opens that unit: its history from the history and growth views, its overview
 * from the others, where a selected commit is compared with its first parent. A page without a
 * unit opens Pages. The category is read from the id; the explorer corrects it from the registry.
 */
export function explorerLegacy(route: ConsoleRoute): ExplorerLocation {
	const scope = { branch: route.branch, commit: route.commit };
	if (!route.unit) return { ...scope, category: 'pages' };
	const history = route.view === 'history' || route.view === 'growth';
	return {
		...scope,
		category: categoryOf(route.unit),
		entity: route.unit,
		...(history ? { section: 'history' as const } : {})
	};
}
