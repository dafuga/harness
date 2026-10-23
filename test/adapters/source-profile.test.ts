import type { Output } from './source-profile.test.types';
export type { Output } from './source-profile.test.types';
import { mkdir, mkdtemp, readFile, rm, writeFile } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { expect, test } from 'vitest';
import { SourceProfileAdapter } from '../../src/adapters/verification-evidence/source-profile-adapter/SourceProfileAdapter';
import { componentManifestSchema } from '../../src/core/development-tooling/unitTypes';
import { benchmarkCaptureSchema } from '../../src/core/verification-evidence/verifyTypes';
import { runCommand } from '../support/cli';
import { taskProfile } from '../support/taskProfiles';

function subject(outputs: Output[] = []) {
	return componentManifestSchema.parse({
		schemaVersion: 1,
		id: 'function.profile-fixture',
		kind: 'function',
		title: 'Profile fixture',
		responsibility: 'Exercise a registered operation in the isolated runner fixture.',
		responsibilityOrigin: 'declared',
		status: 'active',
		owns: { source: ['subject.ts'], symbols: outputs.map((output) => output.name) },
		contract: { origin: 'declared', inputs: [], outputs, errors: [] },
		dependencies: [],
		runtime: {
			kind: 'module',
			entry: 'subject.ts',
			targets: [{ kind: 'module', entry: 'subject.ts' }]
		},
		scenarios: [],
		budgets: { size: 'frozen', complexity: 'frozen', performance: [] }
	});
}

async function captures(directory: string) {
	let index: string;
	try {
		index = await readFile(join(directory, 'captures.ndjson'), 'utf8');
	} catch (error) {
		if ((error as { code?: string }).code === 'ENOENT') return [];
		throw error;
	}
	const measurements = [];
	for (const line of index.trim().split('\n').filter(Boolean)) {
		const file = JSON.parse(line).file;
		const record = benchmarkCaptureSchema.parse(
			JSON.parse(await readFile(join(directory, file), 'utf8'))
		);
		measurements.push(...record.measurements);
	}
	return measurements;
}

async function execute(
	source: string,
	program: string,
	outputs: Output[] = [],
	selfProfile = false
) {
	const root = await mkdtemp(join(tmpdir(), 'harness-source-profiles-'));
	try {
		const path = join(root, 'subject.ts'),
			directory = join(root, 'captures');
		await mkdir(directory);
		await writeFile(path, source);
		const adapter = new SourceProfileAdapter({ root, units: [subject(outputs)] });
		const transformed = adapter.transform(source, path);
		await writeFile(join(root, 'observed.ts'), transformed ?? source);
		await writeFile(
			join(root, 'run.ts'),
			`import * as subject from './observed.ts';\n${program}\n`
		);
		const result = await runCommand(['bun', join(root, 'run.ts')], root, true, {
			BUN_OPTIONS: '',
			HARNESS_RUNTIME_PROFILE_DIR: directory,
			HARNESS_RUNTIME_PROFILE_ROOT: root,
			HARNESS_RUNTIME_PROFILE_CONTEXT: 'fixture-case'
		});
		expect(await readFile(path, 'utf8')).toBe(source);
		if (selfProfile)
			await taskProfile(
				'adapter.source-profile',
				'instrument-registered-module',
				() => adapter.transform(source, path),
				3
			);
		return { result: JSON.parse(result.stdout), measurements: await captures(directory) };
	} finally {
		await rm(root, { recursive: true, force: true });
	}
}

test('registered sync and async operations produce real one-pass observations', async () => {
	const source = `export function add(left: number, right: number) { return left + right; }
export const upper = (title: string) => title.toUpperCase();
export async function delayed(value: number) { await Promise.resolve(); return value * 2; }`;
	const observed = await execute(
		source,
		`console.log(JSON.stringify([subject.add(2,3), subject.upper('title'), await subject.delayed(4)]));`,
		[
			{ name: 'add', type: 'number' },
			{ name: 'upper', type: 'string' },
			{ name: 'delayed', type: 'Promise<number>' }
		],
		true
	);
	expect(observed.result).toEqual([5, 'TITLE', 8]);
	expect(observed.measurements.filter((item) => item.unitOfMeasure === 'ms')).toHaveLength(3);
	expect(observed.measurements.filter((item) => item.unitOfMeasure === 'bytes')).toHaveLength(3);
	expect(
		observed.measurements.every(
			(item) => item.unit === 'function.profile-fixture' && item.samples === 1
		)
	).toBe(true);
	expect(observed.measurements.every((item) => item.value !== null && item.value >= 0)).toBe(true);
});

test('method receivers, private fields and operation counts survive observation', async () => {
	const source = `export class Counter {
 #value = 0;
 next(amount: number) { this.#value += amount; return this.#value; }
 async later() { await Promise.resolve(); return this.next(2); }
 get forbidden() { throw new Error('a getter was inspected'); }
}`;
	const observed = await execute(
		source,
		`const counter = new subject.Counter();
console.log(JSON.stringify([counter instanceof subject.Counter, counter.next(1), await counter.later()]));`,
		[
			{ name: 'Counter.next', type: 'number' },
			{ name: 'Counter.later', type: 'Promise<number>' }
		]
	);
	expect(observed.result).toEqual([true, 1, 3]);
	expect(
		observed.measurements
			.filter((item) => item.unitOfMeasure === 'ms')
			.map((item) => item.samples)
			.sort()
	).toEqual([1, 2]);
});

test('promise identity and rejection behavior remain explicit at unsupported boundaries', async () => {
	const source = `const pending = Promise.resolve(7);
export function cached(): Promise<number> { return pending; }
export async function rejected() { throw new Error('original failure'); }`;
	const observed = await execute(
		source,
		`const first = subject.cached(), second = subject.cached();
let message = '';
try { await subject.rejected(); } catch(error) { message = error.message; }
console.log(JSON.stringify([first === second, await first, message]));`,
		[
			{ name: 'cached', type: 'Promise<number>' },
			{ name: 'rejected', type: 'Promise<never>' }
		]
	);
	expect(observed.result).toEqual([true, 7, 'original failure']);
	expect(observed.measurements).toEqual([]);
});

test('captures never retain operation arguments or returned data', async () => {
	const source = `export function echo(text: string) { return { text }; }`;
	const observed = await execute(
		source,
		`console.log(JSON.stringify(subject.echo('fixture-private-value')));`,
		[{ name: 'echo', type: '{ text: string }' }]
	);
	expect(observed.result).toEqual({ text: 'fixture-private-value' });
	expect(observed.measurements).toHaveLength(2);
	expect(JSON.stringify(observed.measurements)).not.toContain('fixture-private-value');
});

test('unregistered source and deferred generator bodies never gain invented profiles', async () => {
	const adapter = new SourceProfileAdapter({ root: '/fixture', units: [] });
	expect(adapter.transform('export const add = () => 1;', '/fixture/other.ts')).toBeNull();
	const observed = await execute(
		'export function* sequence() { yield 1; yield 2; }',
		`console.log(JSON.stringify([...subject.sequence()]));`,
		[{ name: 'sequence', type: 'Generator<number>' }]
	);
	expect(observed.result).toEqual([1, 2]);
	expect(observed.measurements).toEqual([]);
});
