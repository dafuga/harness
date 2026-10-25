import { expect, test } from 'vitest';
import { execFileSync } from 'node:child_process';
import { fileURLToPath } from 'node:url';

test.each([
	{
		entry: '../src/utils/entityCatalog.ts',
		exports: ['catalogFilter', 'entityCatalog', 'isShared', 'listed']
	},
	{
		entry: '../src/components/explorer-ui/explorer-index/entityCatalog.ts',
		exports: ['catalogFilter']
	}
])('a fresh runtime loads and calls the catalog through $entry', ({ entry, exports }) => {
	const path = fileURLToPath(new URL(entry, import.meta.url));
	const script = `const m = await import(${JSON.stringify(path)}); console.log(JSON.stringify({ types: ${JSON.stringify(exports)}.map(name => typeof m[name]), rows: m.catalogFilter([], { search: '', changedOnly: false, order: 'name' }) }));`;
	const output = execFileSync(process.env.HARNESS_BUN_PATH ?? 'bun', ['-e', script], {
		encoding: 'utf8',
		timeout: 10000
	});
	expect(JSON.parse(output)).toEqual({ types: exports.map(() => 'function'), rows: [] });
});
