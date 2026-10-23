import type { Classified } from './explorerCategory.types';
import { helperContract } from '../../../../../src/utils/helperContract';
import {
	explorerKindCategory,
	type ExplorerCategory
} from '../../../../../src/utils/explorerRoute';

/** What a unit of each kind is called; a kind that is not here is called by its own words. */
const roles = new Map<string, string>([
	['shell', 'Shell'],
	['component', 'Component'],
	['partial', 'Component'],
	['layout', 'Layout'],
	['function', 'Function'],
	['config', 'Config'],
	['service', 'Service'],
	['api', 'Endpoint'],
	['audit', 'Audit rule'],
	['entry', 'Entry point'],
	['style', 'Style sheet']
]);

/** True for a unit that renders an address of the application. */
const renders = (unit: Classified) =>
	unit.owns.source.some((path) => /(^|\/)\+page\.svelte$/.test(path));

/** The framework's former details addresses canonicalize to the existing entity page. */
const compatibility = (unit: Classified) =>
	unit.owns.source.some(
		(path) =>
			path.startsWith('packages/reports/src/routes/harness/') &&
			(path.endsWith('/[entity]/details/+page.svelte') || /\/shells(?:\/|$)/.test(path))
	);

/** Only selected-revision declarations owned by this shared module establish its category. */
function modelCategory(unit: Classified): 'models' | 'types' | null {
	const definitions = (unit.modelDefinitions ?? []).filter((item) =>
		unit.owns.source.includes(item.source)
	);
	if (definitions.some((item) => item.kind === 'class' && (item.table || item.tableGap)))
		return 'models';
	return definitions.length && definitions.every((item) => item.kind !== 'class') ? 'types' : null;
}

const unlisted = (unit: Classified) =>
	unit.catalog?.visibility === 'internal' || nonvisualLayout(unit);

/** A SvelteKit options module configures rendering but renders no pixels itself. */
const layoutConfiguration = (unit: Classified) =>
	unit.kind === 'layout' &&
	unit.owns.source.length > 0 &&
	unit.owns.source.every((path) => /\+layout(?:\.server)?\.[cm]?[jt]s$/.test(path));

const nonvisualLayout = (unit: Classified) =>
	unit.kind === 'layout' &&
	!layoutConfiguration(unit) &&
	!unit.owns.source.some((path) => path.endsWith('.svelte'));

/**
 * The one category a unit is listed under, or null for a unit that is none of the six. A page
 * is what renders an address, whatever kind it was registered as; a route file that renders
 * nothing answers a request, as a service does, and a layout frames pages, as a component does.
 * A rule, a guide, a template, a script or a style sheet has no category: it is not
 * presented as a function, and stays reachable from what depends on it under its own role.
 */
export function explorerCategory(unit: Classified): ExplorerCategory | null {
	if (unlisted(unit)) return null;
	if (compatibility(unit)) return 'services';
	if (renders(unit)) return 'pages';
	if (layoutConfiguration(unit)) return 'configs';
	if (unit.kind === 'model') return modelCategory(unit);
	const category = explorerKindCategory(unit.kind);
	if (category === 'functions' || unit.kind === 'module') {
		return unit.helpers?.some(helperContract) ? 'functions' : null;
	}
	return category === 'pages' ? 'services' : category;
}

/** What a unit is, in words a reader knows: `Page`, `Route loader`, `Audit rule`. */
export function explorerRole(unit: Classified): string {
	if (unit.kind === 'model' && modelCategory(unit) === 'types') return 'Type definitions';
	if (layoutConfiguration(unit)) return 'Route configuration';
	if (compatibility(unit)) return 'Route alias';
	if (renders(unit)) return 'Page';
	if (explorerKindCategory(unit.kind) === 'pages') return 'Route loader';
	const words = unit.kind
		.split(/[^A-Za-z0-9]+/)
		.filter(Boolean)
		.join(' ')
		.toLowerCase();
	const named = roles.get(unit.kind) ?? (words || 'unit');
	return named.charAt(0).toUpperCase() + named.slice(1);
}
