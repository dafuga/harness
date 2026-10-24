import type { Named } from './explorerName.types';
import { explorerCategories } from '../../../../../src/utils/explorerRoute';
import type { HarnessUnit } from '../../models/explorer-ui/Harness.types';
const initials = new Set(['api', 'cli', 'cpu', 'css', 'e2e', 'html', 'id', 'json', 'lfs', 'mcp']);
const more = ['pdf', 'r2', 'sdk', 'ui', 'url', 'wasm', 'wav', 'zip'];
for (const word of more) initials.add(word);
const identifier = /^[A-Za-z][A-Za-z0-9]*$/;
/** The route words that name many of one thing: the collections the explorer lists. */
const collections = new Set<string>(explorerCategories);
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
 * the parameters. A collection of the explorer followed by one of its members is named in the
 * singular, so `…/functions/[entity]/details` is function, details. Any other word stays as it
 * is written: `…/harness/[...path]` is harness. Empty for an address without parameters and for
 * one that ends in them.
 */
function screenOf(title: string): string[] {
	const parts = title.split('/').filter(Boolean);
	const first = parts.findIndex((part) => part.startsWith('['));
	if (!title.startsWith('/') || first < 0) return [];
	const after = parts.slice(first);
	return after.flatMap((part, at) => {
		if (part.startsWith('[')) return [];
		const member = collections.has(part) && after[at + 1]?.startsWith('[');
		return words(member ? part.replace(/s$/, '') : part);
	});
}

/** A code unit keeps its recorded symbol or module name; route screens keep readable labels. */
export function explorerName(unit: Named): string {
	if (['endpoint', 'api'].includes(unit.kind) && unit.title.startsWith('/')) return unit.title;
	const code = codeName(unit);
	if (code) return code;
	const title = unit.title.trim();
	if (written.test(title) && title !== unit.id) return title;
	const screen = screenOf(title);
	if (screen.length > 0) return sentence(screen);
	const tail = unit.id.split('.').pop() ?? '';
	const parts = identifier.test(title) ? words(title) : words(tail);
	return parts.length > 0 ? sentence(parts) : 'Unnamed';
}

const frameworkLayout = (unit: Named) =>
	unit.kind === 'layout' && unit.owns?.source.some((path) => /\/\+layout\.svelte$/.test(path));

/** Owned source decides code identity even when a manifest has a descriptive title. */
function codeName(unit: Named): string | undefined {
	if (frameworkLayout(unit)) return undefined;
	if (
		['page', 'view', 'endpoint', 'api', 'style', 'script', 'template', 'guide', 'audit'].includes(
			unit.kind
		)
	)
		return undefined;
	const stems = (unit.owns?.source ?? [])
		.filter((source) => /\.(?:svelte|[cm]?[jt]sx?)$/.test(source))
		.map((source) =>
			source
				.split('/')
				.at(-1)!
				.replace(/\.[^.]+$/, '')
				.replace(/\.(?:client|server|svelte|d)$/, '')
		)
		.map((stem) => (unit.kind === 'model' ? stem.replace(/\.types$/, '') : stem));
	const symbol = stems.find((stem) => unit.owns?.symbols.includes(stem));
	if (symbol) return symbol;
	const module = stems.find(
		(stem) => stem !== 'index' && (identifier.test(stem) || /^[A-Z][A-Za-z0-9]*\.types$/.test(stem))
	);
	if (module) return module;
	const title = unit.title.trim();
	return identifier.test(title) && unit.kind ? title : undefined;
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
