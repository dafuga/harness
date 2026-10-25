import { TestExpectationService } from '../../src/services/verification-evidence/TestExpectationService';
import type { Helper, HelperCall } from './unit-documentation.test.types';
import { evidenceRequested, recordCapture } from '../../src/utils/record-capture/recordCapture';
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
	{ name: 'An expected error', input: [], error: false },
	{ name: 'No return value', call: 'finish()', input: [], returns: 'void' }
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
		[{ name: 'Ambiguous', input: 1, output: 2, error: 3 }],
		[{ name: 'Ambiguous void', input: null, output: null, returns: 'void' }]
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
	await assertTestingExamples();
});

test('every committed public helper example executes against its real implementation', async () => {
	const files = await readdir('specification/units');
	let total = 0;
	for (const file of files.filter((path) => path.endsWith('.json'))) {
		const unit = JSON.parse(await readFile(`specification/units/${file}`, 'utf8'));
		if (unit.status !== 'active') continue;
		for (const helper of unit.helperContracts ?? []) {
			expect(
				helper.source,
				'Public helper implementation belongs in src/helpers/<responsibility>'
			).toMatch(/(?:^|\/)src\/helpers\/[^/]+\/[^/]+\.ts$/);
			expect(helper.examples?.length, 'Callable examples are required').toBeGreaterThan(0);
			const titles = helper.examples.map((example: { name: string }) =>
				example.name.trim().toLowerCase()
			);
			expect(new Set(titles).size, 'Distinct behavior titles').toBe(titles.length);
			const source = await import(resolve(helper.source));
			for (const example of helper.examples) {
				expect(example.name, 'Descriptive behavior titles').not.toMatch(
					/(?:^|:\s*)(?:example|case|demo|usage)(?:\s*#?\d+)?$/i
				);
				expect(Array.isArray(example.input)).toBe(true);
				await new TestExpectationService().example(
					(input) => source[helper.name](...(input as unknown[])),
					example
				);
				total += 1;
			}
			recordHelperWorkload(unit.id, helper, source[helper.name]);
		}
	}
	expect(total).toBeGreaterThan(0);
});
/** Normal helper documentation checks also retain direct, feature-based workloads. */
function recordHelperWorkload(unit: string, helper: Helper, call: HelperCall) {
	if (!evidenceRequested()) return;
	const slug = helper.name.replace(/([a-z])([A-Z])/g, '$1-$2').toLowerCase();
	const inputs = (helper.examples ?? []).map((example) => {
		if (!Array.isArray(example.input)) throw new Error('Helper example arguments must be an array');
		return example.input;
	});
	const cases = JSON.stringify(inputs);
	const common = {
		unit,
		callable: helper.name,
		workload: `public-helper-${slug}`,
		target: 'module',
		samples: 5000 * inputs.length
	};
	const measurements = [
		{
			...common,
			metric: 'latency-warm-ms',
			unitOfMeasure: 'ms',
			value: helperSamples(inputs, call),
			method: `Vitest median per call across five batches of 1000 passes over documented features after warmup, including returned-value or expected-error checksumming; excludes registry I/O and imports. Inputs: ${cases}`
		},
		{
			...common,
			samples: 1,
			metric: 'memory-bytes',
			unitOfMeasure: 'bytes',
			value: process.memoryUsage().heapUsed,
			method: `Whole Vitest worker used JavaScript heap after this workload, including runner, imported modules and registry documents; not isolated helper allocation. Inputs: ${cases}`
		}
	];
	recordCapture(
		{
			evidence: 'public-helper-workloads',
			state: slug,
			kind: 'benchmark',
			file: `${unit}-${slug}-benchmark.json`,
			mediaType: 'application/json'
		},
		JSON.stringify({ measurements })
	);
}
/** Consume actual returned values so the benchmark cannot discard unused calls. */
function helperSamples(inputs: unknown[][], call: HelperCall): number {
	const samples: number[] = [];
	let checksum = 0;
	for (let round = 0; round < 6; round++) {
		const start = performance.now();
		for (let iteration = 0; iteration < 1000; iteration++)
			for (const args of inputs) {
				try {
					checksum += String(call(...args)).length + 1;
				} catch (error) {
					checksum += String(error).length + 1;
				}
			}
		if (round > 0) samples.push((performance.now() - start) / (1000 * inputs.length));
	}
	expect(checksum).toBeGreaterThan(0);
	return samples.sort((a, b) => a - b)[2];
}

async function assertTestingExamples() {
	const tree = memoryTree({ 'src/utils/finish.ts': 'export function finish(): void {}' });
	const unit = unitOf(
		await indexFiles({ 'src/utils/finish.ts': 'export function finish(): void {}' }),
		'function.finish'
	);
	unit.testing = {
		version: 1,
		shape: 'helper',
		states: ['initialized'],
		examples: [
			{ subject: 'finish', name: 'Finish', call: 'finish()', input: [], expected: { kind: 'void' } }
		],
		cases: [
			{
				id: 'finish',
				state: 'initialized',
				subject: 'finish',
				example: 'Finish',
				test: { file: 'test/finish.test.ts', title: 'finish: Finish' }
			}
		]
	};
	const registry = revisionRegistry([unit], [], new Map());
	await hydrateUnitDocumentation(tree, registry.units);
	expect(registry.units[0].documentation).toEqual({
		path: '',
		examples: [{ name: 'finish: Finish', call: 'finish()', input: [], returns: 'void' }]
	});
}
