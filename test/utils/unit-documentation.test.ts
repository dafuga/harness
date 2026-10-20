import { readdir, readFile } from 'node:fs/promises';
import { resolve } from 'node:path';
import { expect, test } from 'vitest';
import {
	unitDocumentation,
	readUnitDocumentation
} from '../../src/utils/unit-documentation/unitDocumentation';
import { hydrateUnitDocumentation } from '../../src/services/revision-detail-service/unitDocumentation';
import { revisionRegistry } from '../../src/utils/revision-registry/revisionRegistry';
import { indexFiles, memoryTree, unitOf } from '../support/memoryTree';

const id = 'function.rank',
	path = 'src/functions/rank/README.md';
const uses = [
	{
		name: 'Keep values',
		call: 'rank({ enabled: false, limit: 0, empty: null })',
		input: { enabled: false, limit: 0, empty: null },
		output: ''
	},
	{ name: 'An expected error', input: [], error: false }
];
const markdown = (unitId = id, examples: unknown = uses) =>
	'# Rank\n\n```harness-examples\n' +
	JSON.stringify({ schemaVersion: 1, unitId, setup: 'const rank = (value) => value;', examples }) +
	'\n```\n';

test('committed documents preserve expected values and never invent observed results', () => {
	const doc = unitDocumentation(markdown(), id, path);
	expect(doc.examples).toEqual(uses);
	expect(doc).toHaveProperty('setup', 'const rank = (value) => value;');
	expect(doc.text).toBe(markdown());
	expect(doc.gap).toBeUndefined();
	for (const text of [
		markdown('function.other'),
		markdown(id, []),
		markdown() + markdown(),
		'# No examples',
		'```harness-examples\n{bad}\n```'
	]) {
		expect(unitDocumentation(text, id).examples).toEqual([]);
		expect(unitDocumentation(text, id).gap).toBeTruthy();
	}
	for (const examples of [
		[{ name: 'Empty call', call: '', input: 1, output: 1 }],
		[{ name: 'Non-code call', call: { text: 'rank(1)' }, input: 1, output: 1 }],
		[{ name: 'Absent', input: 1 }],
		[{ name: 'Ambiguous', input: 1, output: 2, error: 3 }]
	]) {
		expect(unitDocumentation(markdown(id, examples), id).gap).toBeTruthy();
	}
});

test('revision documents come only from their own tree, and their bytes change the unit version', async () => {
	const source = { 'src/utils/rank.ts': 'export function rank(value: number) { return value; }' };
	const unit = { ...unitOf(await indexFiles(source), id), documentation: path };
	const first = memoryTree({ ...source, [path]: markdown() });
	const second = memoryTree({
		...source,
		[path]: markdown(id, [{ name: 'Later example', input: 1, output: 1 }])
	});
	const stored = async (tree: typeof first) => {
		const blobs = new Map((await tree.list()).map((entry) => [entry.path, entry.hash]));
		const registry = revisionRegistry([unit], [], blobs);
		await hydrateUnitDocumentation(tree, registry.units);
		return registry.units[0];
	};
	const [before, after] = await Promise.all([stored(first), stored(second)]);
	expect(before.documentation?.examples).toEqual(uses);
	expect(after.documentation?.examples[0].name).toBe('Later example');
	expect(before.version).not.toBe(after.version);
	expect(
		await readUnitDocumentation(
			{
				read: async () => {
					throw new Error('absent');
				}
			},
			unit
		)
	).toMatchObject({ examples: [], gap: 'The document is not available at this commit.' });
	expect(await readUnitDocumentation(first, { id })).toBeUndefined();
});

test('every committed public helper example executes against its real implementation', async () => {
	const files = await readdir('specification/units');
	let total = 0;
	for (const file of files.filter((path) => path.endsWith('.json'))) {
		const unit = JSON.parse(await readFile(`specification/units/${file}`, 'utf8'));
		if (unit.status !== 'active') continue;
		for (const helper of unit.helperContracts ?? []) {
			expect(helper.examples?.length, 'Callable examples are required').toBeGreaterThan(0);
			const source = await import(resolve(helper.source));
			for (const example of helper.examples) {
				expect(Array.isArray(example.input)).toBe(true);
				expect(source[helper.name](...example.input), `${unit.id} ${example.name}`).toEqual(
					example.output
				);
				total += 1;
			}
		}
	}
	expect(total).toBeGreaterThan(0);
});
