import { existsSync, readFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { scanImports } from '../../src/services/source-index-service/scanImports';
import type { SourceFile } from '../../src/core/sourceTypes';
export const publicSelect = 'packages/reports/src/components/Select.svelte';
/** The implementation changes; the forwarding entry stays an independent importer. */
export const select = 'packages/reports/src/components/shared-primitives/Select.svelte';
const selectSources = new Set([select, publicSelect]);
export interface Written {
	from: string;
	specifier: string;
	to: string | undefined;
}
/** The build aliases a package's Svelte configuration declares, each with the place it names. */
export function aliases(name: string): Record<string, string> {
	const file = join('packages', name, 'svelte.config.js');
	const stated = existsSync(file) ? /alias:\s*\{([^}]*)\}/.exec(readFileSync(file, 'utf8')) : null;
	const pairs = [...(stated?.[1] ?? '').matchAll(/(\$\w+):\s*'([^']+)'/g)];
	return Object.fromEntries(pairs.map(([, alias, target]) => [alias, target]));
}
/** The alias imports one file really writes, each with the tracked file its build sends it to. */
export function imports(
	from: string,
	builds: Record<string, Record<string, string>>,
	files: Map<string, SourceFile>
): Written[] {
	const [, name = ''] = /^packages\/([^/]+)\//.exec(from) ?? [];
	const language = /\.(svelte|css|ts)$/.exec(from)?.[1] as 'svelte' | 'css' | 'ts' | undefined;
	const own = Object.entries(builds[name] ?? {});
	if (!language || own.length === 0) return [];
	const found = scanImports(readFileSync(from, 'utf8'), language);
	return found.flatMap((item) => {
		const [alias, target] = own.find(([key]) => item.specifier?.startsWith(`${key}/`)) ?? [];
		if (!item.specifier) return [];
		if (!alias || !target) {
			const to = join(dirname(from), item.specifier);
			return selectSources.has(to) ? [{ from, specifier: item.specifier, to }] : [];
		}
		const path = join('packages', name, target, item.specifier.slice(alias.length + 1));
		const to = [path, `${path}.ts`].find((candidate) => files.has(candidate));
		return [{ from, specifier: item.specifier, to }];
	});
}
