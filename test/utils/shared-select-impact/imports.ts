import { existsSync, readFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { scanImports } from '../../../src/services/source-index-service/scanImports';
import type { UnitsConfig } from '../../../src/core/development-tooling/unitsConfig.types';
import type { SourceIndex } from '../../../src/services/development-tooling/source-index-service/SourceIndexService';
import type { Written } from '../../shared-select-impact.test.types';

export function readBuildAliases(name: string): Record<string, string> {
	const file = join('packages', name, 'svelte.config.js');
	const stated = existsSync(file) ? /alias:\s*\{([^}]*)\}/.exec(readFileSync(file, 'utf8')) : null;
	const pairs = [...(stated?.[1] ?? '').matchAll(/(\$\w+):\s*'([^']+)'/g)];
	return Object.fromEntries(pairs.map(([, alias, target]) => [alias, target]));
}

export function hasExpectedSourceBinding(references: UnitsConfig['references'], item: Written) {
	if (!item.specifier.startsWith('$')) return true;
	return references.some(
		({ from, specifier, to }) =>
			from === item.from && specifier === item.specifier && to === item.to
	);
}

export function readSelectImports(
	index: SourceIndex,
	builds: Record<string, Record<string, string>>,
	from: string,
	entries: string[]
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
			return entries.includes(to) ? [{ from, specifier: item.specifier, to }] : [];
		}
		const path = join('packages', name, target, item.specifier.slice(alias.length + 1));
		const to = [path, `${path}.ts`, `${path}.d.ts`].find((candidate) => index.files.has(candidate));
		return [{ from, specifier: item.specifier, to }];
	});
}
