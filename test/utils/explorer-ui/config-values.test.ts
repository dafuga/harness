import { expect, test } from 'vitest';
import { configValues } from '../../../src/services/explorer-ui/revision-detail-service/configValues';
import { measureWorkload } from '../../support/measureWorkload';
import { unitMetadata } from '../../../src/services/revision-detail-service/unitMetadata';
import { revisionRegistry } from '../../../src/utils/revision-registry/revisionRegistry';
import { indexFiles, memoryTree } from '../../support/memoryTree';

test.each([
	[
		'export const enabled = false; export const retryCount = 0; export const fallback = null; export const label = "";',
		[
			['enabled', 'false'],
			['retryCount', '0'],
			['fallback', 'null'],
			['label', '""']
		]
	],
	[
		'export const options = {pageSize: 25, nested: {sort: "newest"}} as const;',
		[
			['options.pageSize', '25'],
			['options.nested.sort', '"newest"']
		]
	],
	[
		'const limit = 10; export default defineConfig({limit, build: {enabled: true}});',
		[
			['settings.limit', '10'],
			['settings.build.enabled', 'true']
		]
	],
	[
		'export const endpoint = process.env.ORIGIN ?? "local";',
		[['endpoint', 'process.env.ORIGIN ?? "local"']]
	],
	['export const options = {...defaults, limit: 25};', [['options', '{...defaults, limit: 25}']]],
	[
		'export function readConfig() { throw Error("never execute"); } export { options } from "./other";',
		[]
	],
	['const a = b; const b = a; export const loop = a;', [['loop', 'a']]],
	[
		'export const settings = {self: settings, "a.b": false, "1": 0};',
		[
			['settings.self', 'settings'],
			['settings["a.b"]', 'false'],
			['settings["1"]', '0']
		]
	]
] as const)(
	'reads config initializer expressions without running them: %s',
	async (source, entries) =>
		measureWorkload('function.unit-metadata', 'config-initializer-source', () => {
			expect(configValues(source, 'src/config/settings.ts')).toEqual(
				entries.map(([name, value]) => ({ name, value, source: 'src/config/settings.ts' }))
			);
		})
);

test('revision metadata carries nested config values from its own source', async () => {
	const source = 'src/config/settings.ts';
	const files = { [source]: 'export default defineConfig({build: {outDir: "dist"}});' };
	const indexed = await indexFiles(files);
	const registry = revisionRegistry(indexed.result.manifests, []);
	await measureWorkload('function.unit-metadata', 'config-revision-metadata', () =>
		unitMetadata(memoryTree(files), registry.units)
	);
	expect(registry.units[0]).toHaveProperty('configValues', [
		{ name: 'settings.build.outDir', value: '"dist"', source }
	]);
});

test('JSON config keys keep their actual scalar values', () => {
	expect(configValues('{"port": 8080, "feature": {"enabled": false}}', 'settings.json')).toEqual([
		{ name: 'settings.port', value: '8080', source: 'settings.json' },
		{ name: 'settings.feature.enabled', value: 'false', source: 'settings.json' }
	]);
});
