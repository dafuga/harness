import type { TranslationScan } from './translationCatalog.types';
import { posix } from 'node:path';
import type { SourceTree } from '../../../core/development-tooling/sourceTypes';
import type {
	TranslationCatalog,
	TranslationRow
} from '../../../core/explorer-ui/Translation.types';
import type { RevisionRegistry } from '../../../utils/revisionRegistry';
import { flattenMessages, translationMessages } from './translationMessages';

/** Read only this revision's app dictionaries and their literal runtime message references. */
export async function translationCatalog(
	tree: SourceTree,
	units: RevisionRegistry['units'] = []
): Promise<TranslationCatalog> {
	const rows = new Map<string, TranslationRow>();
	const locales = new Set<string>();
	const gaps: string[] = [];
	const consumers = new Map<string, Set<string>>();
	for await (const source of sources(tree))
		await addSource(tree, { rows, locales, gaps, consumers }, source);
	for (const [identity, row] of rows) {
		const paths = consumers.get(identity) ?? new Set<string>();
		row.usedBy = units
			.filter((unit) => unit.owns.source.some((path) => paths.has(path)))
			.map((unit) => unit.id);
	}
	return {
		locales: [...locales].sort(),
		rows: [...rows.values()].sort(order),
		gaps: [...new Set(gaps)]
	};
}

/** Batch source reads so Git snapshots use cat-file batching rather than one process per file. */
async function* sources(tree: SourceTree) {
	const files = (await tree.list()).filter((item) =>
		/(?:^|\/)src\/.*\.(?:[cm]?[jt]sx?|svelte)$/.test(item.path)
	);
	for (let start = 0; start < files.length; start += 64) {
		const batch = await Promise.all(
			files.slice(start, start + 64).map(async ({ path }) => ({
				path,
				text: await tree.read(path)
			}))
		);
		for (const source of batch) yield source;
	}
}

function remember(index: Map<string, Set<string>>, key: string, path: string) {
	const paths = index.get(key) ?? new Set<string>();
	paths.add(path);
	index.set(key, paths);
}

function resourcePath(source: string, relative: string): string {
	if (!relative.startsWith('.'))
		throw new Error('Only repository-relative JSON resources are read.');
	const path = posix.normalize(posix.join(posix.dirname(source), relative));
	if (path.startsWith('../') || path.startsWith('/'))
		throw new Error('Resource leaves the repository.');
	return path;
}

function addRows(
	rows: Map<string, TranslationRow>,
	context: { scope: string; locale: string; source: string },
	messages: Record<string, string>,
	gaps: string[]
) {
	for (const [key, value] of Object.entries(messages)) {
		const identity = `${context.scope}\n${key}`;
		const row = rows.get(identity) ?? {
			scope: context.scope,
			key,
			values: Object.create(null) as Record<string, string>,
			sources: [],
			usedBy: []
		};
		if (Object.hasOwn(row.values, context.locale) && row.values[context.locale] !== value)
			gaps.push(`${context.scope}: Conflicting ${context.locale} translations for ${key}.`);
		else row.values[context.locale] = value;
		if (!row.sources.includes(context.source)) row.sources.push(context.source);
		rows.set(identity, row);
	}
}

function order(left: TranslationRow, right: TranslationRow) {
	return left.scope.localeCompare(right.scope) || left.key.localeCompare(right.key);
}

async function addSource(
	tree: SourceTree,
	scan: TranslationScan,
	sourceFile: { path: string; text: string }
) {
	const { rows, locales, gaps, consumers } = scan;
	const { path, text } = sourceFile;
	try {
		if (!/(?:svelte-i18n|\$(?:t|_)\()/.test(text)) return;
		const source = translationMessages(text);
		const scope = path.includes('/src/') ? path.split('/src/')[0] : '.';
		gaps.push(...source.gaps.map((gap) => `${path}: ${gap}`));
		for (const key of source.keys) remember(consumers, `${scope}\n${key}`, path);
		for (const registration of source.registrations) {
			const resource = registration.resource && resourcePath(path, registration.resource);
			const messages = resource
				? flattenMessages(JSON.parse(await tree.read(resource)))
				: (registration.messages ?? {});
			locales.add(registration.locale);
			addRows(
				rows,
				{ scope, locale: registration.locale, source: resource ?? path },
				messages,
				gaps
			);
		}
	} catch {
		gaps.push(`${path}: Translation source could not be read at this revision.`);
	}
}
