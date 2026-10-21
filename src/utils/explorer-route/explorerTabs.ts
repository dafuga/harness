import type { ExplorerLocation } from '../explorerRoute';

/**
 * The tabs a section supports; helpers use path segments and legacy modules use the query.
 * `relationships` is the former address of what `used-in` and `uses` show: it is still read.
 * Source is optional on the entity page; Details is accepted only as a legacy address.
 */
export const explorerTabs = {
	overview: [
		'overview',
		'contract',
		'used-in',
		'uses',
		'relationships',
		'tests',
		'examples',
		'states',
		'source'
	],
	details: ['contract', 'measurements', 'source'],
	history: []
} as const satisfies Record<string, readonly string[]>;
export type ExplorerTab = (typeof explorerTabs)[keyof typeof explorerTabs][number];

/** The tab a query names, when the shown section has it and it is not the default one. */
export function tabOf(location: ExplorerLocation, search: string): ExplorerTab | undefined {
	if (!location.entity && !location.helper) return undefined;
	const [, ...others] = explorerTabs[location.section ?? 'overview'] as readonly ExplorerTab[];
	let asked = new URLSearchParams(search).get('tab');
	const visual = ['pages', 'components', 'shells'].includes(location.category);
	if (visual && asked === 'tests') asked = 'states';
	if (location.category === 'functions' && asked === 'tests') asked = 'examples';
	if (!visual && asked === 'states') return undefined;
	return others.find((known) => known === asked);
}
