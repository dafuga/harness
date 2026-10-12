import type { HarnessUnit } from '../models/Harness.types';

type Named = Pick<HarnessUnit, 'id' | 'kind' | 'title'>;
const initials = new Set(['api', 'cli', 'cpu', 'css', 'e2e', 'html', 'id', 'json', 'lfs', 'mcp']);
const more = ['pdf', 'r2', 'sdk', 'ui', 'url', 'wasm', 'wav', 'zip'];
for (const word of more) initials.add(word);
const identifier = /^[A-Za-z][A-Za-z0-9]*$/;
/** A title a person wrote: several words, and no address, file ending or dotted id in it. */
const written = /^(?=.*\s)(?!.*[/\\[\]+])(?!.*\.[a-z0-9]+(\s|$))[^.]*$/i;

/** The words of an identifier: `r2EvidenceConfig` is r2, evidence, config. */
function words(text: string): string[] {
	return text
		.replace(/([a-z0-9])([A-Z])/g, '$1 $2')
		.replace(/([A-Z]+)([A-Z][a-z])/g, '$1 $2')
		.split(/[^A-Za-z0-9]+/)
		.filter(Boolean)
		.map((word) => word.toLowerCase());
}

/** The words a reader is shown: sentence case, with known initials as they are written. */
function sentence(parts: string[]): string {
	const shown = parts.map((word) => (initials.has(word) ? word.toUpperCase() : word));
	const [first = '', ...rest] = shown;
	return [first.charAt(0).toUpperCase() + first.slice(1), ...rest].join(' ');
}

/**
 * The words of the screen a route address ends in: what follows its first parameter, without
 * the parameters. A collection followed by one of its members is named in the singular, so
 * `…/functions/[entity]/details` is function, details. Empty for an address without parameters
 * and for one that ends in them.
 */
function screenOf(title: string): string[] {
	const parts = title.split('/').filter(Boolean);
	const first = parts.findIndex((part) => part.startsWith('['));
	if (!title.startsWith('/') || first < 0) return [];
	const after = parts.slice(first);
	return after.flatMap((part, at) => {
		if (part.startsWith('[')) return [];
		const one = after[at + 1]?.startsWith('[') ? part.replace(/s$/, '') : part;
		return words(one);
	});
}

/**
 * The name a reader is shown for a unit: its title as written when a person wrote one, the words
 * of its title when the title is one identifier, the screen a route address ends in, else the
 * words of the last part of its id. It is never an id, an address or a file.
 */
export function explorerName(unit: Named): string {
	const title = unit.title.trim();
	if (written.test(title) && title !== unit.id) return title;
	const screen = screenOf(title);
	if (screen.length > 0) return sentence(screen);
	const tail = unit.id.split('.').pop() ?? '';
	const parts = identifier.test(title) ? words(title) : words(tail);
	return parts.length > 0 ? sentence(parts) : 'Unnamed';
}

/** The address a route file serves: `src/routes/titles/+page.svelte` is `/titles`. */
function served(source: string[]): string | null {
	const file = source.find((path) => /\/routes\/(.*\/)?\+page\.svelte$/.test(path));
	if (!file) return null;
	const inside = file.slice(file.indexOf('/routes/') + '/routes'.length);
	return inside.replace(/\/\+page\.svelte$/, '') || '/';
}

/**
 * The address the application serves a page at: its title when the title is one, else the
 * address of the route file it owns. Null for what is not a page and for a page that names none.
 */
export function explorerAppRoute(
	unit: Pick<HarnessUnit, 'kind' | 'title' | 'owns'>
): string | null {
	if (unit.kind !== 'page' && unit.kind !== 'layout') return null;
	return unit.title.startsWith('/') ? unit.title : served(unit.owns.source);
}
