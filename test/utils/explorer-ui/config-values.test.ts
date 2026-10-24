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
		'export default defineConfig(({ mode }) => ({ mode }));',
		[['settings', '({ mode }) => ({ mode })']]
	],
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
			expect(
				configValues(source, 'src/config/settings.ts').map(({ name, value, source }) => ({
					name,
					value,
					source
				}))
			).toEqual(
				entries.map(([name, value]) => ({ name, value, source: 'src/config/settings.ts' }))
			);
		})
);

test('revision metadata selects declared controls without importing internal constants', async () => {
	const source = 'src/config/settings.ts';
	const files = {
		[source]: 'export default defineConfig({limit: 0, documentation: "Internal metadata"});'
	};
	const indexed = await indexFiles(files);
	const registry = revisionRegistry(indexed.result.manifests, []);
	Object.assign(registry.units[0], {
		configControls: [
			{
				source,
				name: 'settings.limit',
				purpose: 'Limit retained reports to fit the available storage.',
				audience: 'operator'
			}
		]
	});
	await measureWorkload('function.unit-metadata', 'config-revision-metadata', () =>
		unitMetadata(memoryTree(files), registry.units)
	);
	expect(registry.units[0]).toHaveProperty('configValues', [
		{ name: 'settings.limit', value: '0', source, literal: 0 }
	]);
	await unitMetadata(memoryTree({}), registry.units);
	expect(registry.units[0].configValues).toEqual([]);
});

test('JSON config keys keep their actual scalar values', () => {
	expect(configValues('{"port": 8080, "feature": {"enabled": false}}', 'settings.json')).toEqual([
		{ name: 'settings.port', value: '8080', source: 'settings.json', literal: 8080 },
		{ name: 'settings.feature.enabled', value: 'false', source: 'settings.json', literal: false }
	]);
});

test.each([
	["'A \\'quoted\\' name'", "A 'quoted' name"],
	['"<orders> & details"', '<orders> & details'],
	[JSON.stringify('orders/'.repeat(35)), 'orders/'.repeat(35)],
	[
		'`Review the order checklist.\nKeep <orders> & details together.`',
		'Review the order checklist.\nKeep <orders> & details together.'
	],
	['false', false],
	['0', 0],
	['-1', -1],
	['null', null],
	['""', ''],
	["['ca', 'us', false, 0]", ['ca', 'us', false, 0]]
])('decodes static config literals while retaining source: %s', (expression, literal) => {
	expect(
		configValues(`export const setting = ${expression};`, 'src/configs/settings.ts').map(
			({ name, value, source, literal }) => ({ name, value, source, literal })
		)
	).toEqual([{ name: 'setting', value: expression, source: 'src/configs/settings.ts', literal }]);
});

test.each(['process.env.SECRET', '[...defaults]', '[readSecret()]', '`hello ${readSecret()}`'])(
	'keeps computed config expressions unevaluated: %s',
	(expression) => {
		const [setting] = configValues(
			`export const setting = ${expression};`,
			'src/configs/settings.ts'
		);
		expect(setting.value).toBe(expression);
		expect(setting).not.toHaveProperty('literal');
	}
);
// Structural inspection is data read from the AST, alongside the unchanged source-value contract.
test.each([
	[
		'export const schema = z\n  .strictObject({schemaVersion: z.literal(1), groups: z.array(group), legacy: z.array(z.string())})\n  .superRefine(check);',
		'schema',
		{
			kind: 'object',
			count: 3,
			entries: [
				{ name: 'schemaVersion', node: { kind: 'expression', source: 'z.literal(1)' } },
				{ name: 'groups', node: { kind: 'array' } },
				{ name: 'legacy', node: { kind: 'array' } }
			]
		}
	],
	['export const schema = z\n  .array(z.string());', 'schema', { kind: 'array', schema: true }],
	[
		'export const schema = z.strictObject({id: z.string(), groups: z.array(z.string())}).superRefine(check);',
		'schema',
		{
			kind: 'object',
			count: 2,
			entries: [
				{ name: 'id', node: { kind: 'expression', source: 'z.string()' } },
				{ name: 'groups', node: { kind: 'array', source: 'z.array(z.string())' } }
			]
		}
	],
	[
		'export const values = [{name: "First", flags: [true, false]}, "Second"];',
		'values',
		{
			kind: 'array',
			count: 2,
			entries: [
				{
					name: '0',
					node: {
						kind: 'object',
						count: 2,
						entries: [
							{ name: 'name', node: { kind: 'expression', source: '"First"' } },
							{ name: 'flags', node: { kind: 'array', count: 2 } }
						]
					}
				},
				{ name: '1', node: { kind: 'expression', source: '"Second"' } }
			]
		}
	],
	['export const empty = [];', 'empty', { kind: 'array', count: 0, entries: [] }],
	[
		'export const schema = z.object({settings: z.strictObject({enabled: z.boolean()})});',
		'schema',
		{
			kind: 'object',
			count: 1,
			entries: [{ name: 'settings', node: { kind: 'object', count: 1 } }]
		}
	]
])(
	'reads inspectable collection structure without execution: %s',
	async (source, name, structure) => {
		await measureWorkload('function.unit-metadata', 'config-collection-structure', () => {
			const result = configValues(source, 'settings.ts').find((item) => item.name === name);
			expect(result, 'committed collection structure is inspectable').toMatchObject({
				name,
				structure
			});
		});
	}
);

test('unresolved collection sizes stay unknown and source code is never executed', async () => {
	await measureWorkload('function.unit-metadata', 'config-unknown-collection-size', () => {
		const source =
			'export const values = [first(), ...rest]; export const schema = z.object({...base, id: z.string()}); export const unsafe = (() => { throw Error("must not run") })();';
		const values = configValues(source, 'settings.ts');
		expect(values).toMatchObject([
			{ name: 'values', structure: { kind: 'array' } },
			{ name: 'schema', structure: { kind: 'object' } },
			{ name: 'unsafe', value: '(() => { throw Error("must not run") })()' }
		]);
		for (const value of values.slice(0, 2)) expect(value).not.toHaveProperty('structure.count');
		expect(values[2]).not.toHaveProperty('structure');
	});
});
