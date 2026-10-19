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
