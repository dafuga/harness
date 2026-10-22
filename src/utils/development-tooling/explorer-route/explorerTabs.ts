import type { ExplorerLocation } from '../../explorerRoute';

/**
 * The tabs a section supports; helpers use path segments and legacy modules use the query.
 * `relationships` is the former address of what `used-in` and `uses` show: it is still read.
 * Source is optional on the entity page; Details is accepted only as a legacy address.
 */
export const explorerTabs = {
	overview: [
		'overview',
		'contract',
		'models',
		'used-in',
		'uses',
		'relationships',
		'audio',
		'tests',
		'examples',
		'states',
		'source'
	],
	details: ['contract', 'models', 'measurements', 'source'],
	history: []
} as const satisfies Record<string, readonly string[]>;
export type ExplorerTab = (typeof explorerTabs)[keyof typeof explorerTabs][number];

function invalidAudioTab(asked: string | null, location: ExplorerLocation): boolean {
	return asked === 'audio' && location.category !== 'components';
}

/** Page-only tabs and the legacy Contract address retain their category rules. */
function pageQueryTab(asked: string | null, category: ExplorerLocation['category']) {
	if (asked === 'models' && category !== 'pages') return undefined;
	if (category === 'pages') {
		if (asked === 'contract') return 'models';
		if (asked === 'used-in') return undefined;
	}
	return asked;
}

/** Keep the category checks in their original order while selecting a query tab. */
function tabQuery(location: ExplorerLocation, search: string): string | null | undefined {
	const requested = new URLSearchParams(search).get('tab');
	const visual = ['pages', 'components', 'shells'].includes(location.category);
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
	if (!location.entity && !location.helper) return undefined;
	const [, ...others] = explorerTabs[location.section ?? 'overview'] as readonly ExplorerTab[];
	const asked = tabQuery(location, search);
	if (asked === undefined) return undefined;
	return others.find((known) => known === asked);
}
