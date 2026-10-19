import { expect, test } from 'vitest';
import { unitMetadata } from '../../src/utils/unitMetadata';
import { revisionRegistry } from '../../src/utils/revisionRegistry';
import { indexFiles, memoryTree } from '../support/memoryTree';

const source = [
	'export type Options = { enabled: boolean };',
	'export const schema = { parse: true };',
	'export const count = (1 + 2);',
	'export const typed: (value: string) => string = (value) => value;',
	'export const single = value => value;',
	'function privateHelper() { return 1; }',
	'export class Internals { run() { return 1; } }',
	'export function unused(value: number) { return value; }',
	'export const sharedArrow = (text: string): string => text;'
].join('\n');

test('revision metadata lists standalone shared exports without requiring callers', async () => {
	const paths = [
		'src/utils/helpers.ts',
		'packages/app/src/lib/utils/helpers.ts',
		'src/components/local.ts',
		'src/services/local.ts',
		'src/rules/local.ts'
	];
	const files = Object.fromEntries(paths.map((path) => [path, source]));
	const indexed = await indexFiles(files);
	const registry = revisionRegistry(indexed.result.manifests, []);
	await unitMetadata(memoryTree(files), registry.units);
	for (const unit of registry.units) {
		const path = unit.owns.source[0];
		const names = unit.helpers?.map((helper) => helper.name);
		expect(names).toEqual(
			path.includes('/utils/') ? ['typed', 'single', 'unused', 'sharedArrow'] : []
		);
	}
	const shared = registry.units.find((unit) => unit.owns.source[0] === paths[0])!;
	await unitMetadata(memoryTree({ [paths[0]]: 'export function later() {}' }), [shared]);
	expect(shared.helpers?.map((helper) => helper.name)).toEqual(['later']);
	await unitMetadata(memoryTree({}), [shared]);
	expect(shared.helpers).toEqual([]);
	expect(shared.helperGap).toContain('could not be read');
});

const cases: Array<{ files: Record<string, string>; count: number }> = [
	{
		files: {
			'src/services/OneService.ts':
				"import { shared } from '../utils/shared'; export class OneService { run() { shared(); shared(); } }"
		},
		count: 1
	},
	{
		files: {
			'src/utils/callers.ts':
				"import { shared as use } from './shared'; export function first() { use(); use(); } export function second() { [1].map(use); }"
		},
		count: 2
	},
	{
		files: {
			'src/components/One.svelte':
				"<script>import { shared } from '../utils/shared';</script><p>{shared()}</p>",
			'src/services/TwoService.ts':
				"import * as helpers from '../utils/shared'; export class TwoService { run() { helpers.shared(); } }"
		},
		count: 2
	},
	{
		files: {
			'src/utils/callers.ts':
				"import { shared } from './shared'; export function first(shared: Function) { shared(); }",
			'src/utils/types.ts':
				"import type { shared } from './shared'; export type Example = typeof shared;"
		},
		count: 0
	},
	{
		files: {
			'src/utils/callers.ts':
				"import { shared, other } from './shared'; export function first() { other(); }"
		},
		count: 0
	},
	{
		files: {
			'src/pages/one.ts': "import { shared } from '../utils/shared'; shared();",
			'src/utils/barrel.ts': "export { shared } from './shared';",
			'src/utils/callers.ts':
				"import { shared } from './barrel'; export function first() { shared(); }"
		},
		count: 1
	}
];
test.each(cases)(
	'revision metadata counts distinct actual consumers: $count',
	async ({ files, count }) => {
		const sources = {
			'src/utils/shared.ts':
				'export function shared() { return shared; }\nexport function other() {}',
			...files
		};
		const indexed = await indexFiles(sources);
		const registry = revisionRegistry(indexed.result.manifests, []);
		await unitMetadata(memoryTree(sources), registry.units);
		const helper = registry.units
			.find((unit) => unit.id === 'function.shared')!
			.helpers!.find((helper) => helper.name === 'shared')!;
		expect(
			helper.consumers?.length,
			'distinct services, components and functions count as users'
		).toBe(count);
		const earlier = memoryTree({ 'src/utils/shared.ts': sources['src/utils/shared.ts'] });
		await unitMetadata(earlier, registry.units);
		expect(
			registry.units.find((unit) => unit.id === 'function.shared')!.helpers![0].consumers
		).toEqual([]);
	}
);
