import type { ExplorerCategory, ExplorerTab } from './explorerTabs.types';
import type { ExplorerLocation } from '../../explorerRoute';

/** The entity collections supported by explorer addresses. */
export const explorerEntityCategories = [
	'pages',
	'apis',
	'layouts',
	'components',
	'functions',
	'configs',
	'services',
	'models',
	'types'
] as const;
export const explorerCategories = [...explorerEntityCategories, 'platforms'] as const;

/** The kinds of unit a product is made of, each under the one category it is listed in. */
const kinds = new Map<string, ExplorerCategory>([
	['page', 'pages'],
	['view', 'pages'],
	// Layouts declare a reusable frame; application hosts remain components.
	['shell', 'components'],
	['component', 'components'],
	['partial', 'components'],
	['layout', 'layouts'],
	['function', 'functions'],
	['validator', 'functions'],
	['serializer', 'functions'],
	['kernel', 'functions'],
	['helper', 'functions'],
	['decorator', 'functions'],
	['policy', 'functions'],
	['form', 'functions'],
	['config', 'configs'],
	['initializer', 'configs'],
	['model', 'models'],
	['service', 'services'],
	['endpoint', 'apis'],
	['api', 'apis'],
	['adapter', 'services'],
	['repository', 'services'],
	['workflow', 'services'],
	['command', 'services'],
	['controller', 'services'],
	['job', 'services'],
	['channel', 'services'],
	['middleware', 'services'],
	['hook', 'services'],
	['mailer', 'services']
]);

/**
 * The category a kind of unit is listed under. Null for a kind that is none of the seven: a rule,
 * a guide, a template, a script or anything unknown is not presented as a function.
 */
export function explorerKindCategory(kind: string): ExplorerCategory | null {
	return kinds.get(kind) ?? null;
}

/**
 * The tabs a section supports; helpers use path segments and legacy modules use the query.
 * `relationships` is the former address of what `used-in` and `uses` show: it is still read.
 * Source is optional on the entity page; Details is accepted only as a legacy address.
 */
export const explorerTabs = {
	overview: [
		'overview',
		'contract',
		'table',
		'models',
		'apis',
		'used-in',
		'uses',
		'relationships',
		'audio',
		'tests',
		'examples',
		'states',
		'source'
	],
	details: ['contract', 'table', 'models', 'measurements', 'source'],
	history: []
} as const satisfies Record<string, readonly string[]>;

function invalidAudioTab(asked: string | null, location: ExplorerLocation): boolean {
	return asked === 'audio' && location.category !== 'components';
}

/** Page-only tabs and the legacy Contract address retain their category rules. */
function pageQueryTab(asked: string | null, category: ExplorerLocation['category']) {
	if (asked === 'table' && category !== 'models') return undefined;
	if ((asked === 'models' || asked === 'apis') && category !== 'pages') return undefined;
	if (category === 'pages') {
		if (asked === 'contract') return 'models';
		if (asked === 'used-in') return undefined;
	}
	return asked;
}

/** Keep the category checks in their original order while selecting a query tab. */
function tabQuery(location: ExplorerLocation, search: string): string | null | undefined {
	const requested = new URLSearchParams(search).get('tab');
	const visual = ['pages', 'components', 'layouts'].includes(location.category);
	if (invalidAudioTab(requested, location)) return undefined;
	let asked = pageQueryTab(requested, location.category);
	if (asked === undefined) return undefined;
	if (visual && asked === 'tests') asked = 'states';
	if (location.category === 'functions' && asked === 'tests') asked = 'examples';
	if (!visual && asked === 'states') return undefined;
	return asked;
}

/** The tab a query names, when the shown section has it and it is not the default one. */
export function tabOf(location: ExplorerLocation, search: string): ExplorerTab | undefined {
	if (location.category === 'platforms') return undefined;
	if (!location.entity && !location.helper) return undefined;
	const [, ...others] = explorerTabs[location.section ?? 'overview'] as readonly ExplorerTab[];
	const asked = tabQuery(location, search);
	if (asked === undefined) return undefined;
	return others.find((known) => known === asked);
}

export type { ExplorerCategory, ExplorerTab } from './explorerTabs.types';
