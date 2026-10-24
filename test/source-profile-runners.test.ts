import { readFile } from 'node:fs/promises';
import { join } from 'node:path';
import { expect, test } from 'vitest';
import {
	assertProjectBootstrap,
	preload,
	runnerCaptures,
	runnerFixture,
	source
} from './support/sourceProfileRunners';

test('normal Vitest imports and its Bun commands capture their own real operations', async () => {
	const fixture = await runnerFixture();
	try {
		await fixture.write(
			'subject.test.ts',
			`import { expect, test } from 'vitest';
import { spawnSync } from 'node:child_process';
import { writeFileSync } from 'node:fs';
import { greet } from './subject';
test('real source operations',()=>{
 expect(greet('direct')).toBe('DIRECT');
 writeFileSync('node-rss.json',JSON.stringify(process.memoryUsage().rss));
 const child=spawnSync('bun',['run.ts'],{encoding:'utf8',env:process.env});
 expect([child.status,child.stdout.trim(),child.stderr]).toEqual([0,'FIXTURE-VALUE','']);
});`
		);
		await fixture.run(['bun', 'x', 'vitest', 'run'], fixture.environment);
		const measurements = await runnerCaptures(fixture.directory, fixture.root);
		expect(
			measurements.filter((item) => item.unitOfMeasure === 'ms'),
			'both actual runners require source observations'
		).toHaveLength(2);
		expect(measurements.filter((item) => item.unitOfMeasure === 'bytes')).toHaveLength(2);
		expect(
			measurements.every((item) => item.unit === 'function.runner-fixture' && item.samples === 1)
		).toBe(true);
		expect(JSON.stringify(measurements)).not.toMatch(/fixture-value|DIRECT/);
		expect(await readFile(join(fixture.root, 'subject.ts'), 'utf8')).toBe(source);
	} finally {
		await fixture.remove();
	}
}, 30_000);

test('Bun runtime profiling leaves actual build artifacts uninstrumented', async () => {
	const fixture = await runnerFixture();
	try {
		await fixture.write(
			'run.ts',
			`import { greet } from './subject';
const build=await Bun.build({entrypoints:['./subject.ts'],target:'bun'});
if(!build.success) throw Error('build failed');
const bytes=await build.outputs[0].text();
console.log(JSON.stringify({value:greet('real'),instrumented:bytes.includes('__harnessWatch_')}));`
		);
		const ran = await fixture.run(['bun', '--preload', preload, 'run.ts'], fixture.environment);
		expect(JSON.parse(ran.stdout)).toEqual({ value: 'REAL', instrumented: false });
		const measurements = await runnerCaptures(fixture.directory);
		expect(
			measurements.filter((item) => item.unitOfMeasure === 'ms'),
			'Bun preload requires actual source observations'
		).toHaveLength(1);
		expect(measurements.filter((item) => item.unitOfMeasure === 'bytes')).toHaveLength(1);
		assertProjectBootstrap(fixture.environment);
	} finally {
		await fixture.remove();
	}
}, 30_000);

test('ordinary runs and explicit benchmark boundaries retain the original operation', async () => {
	const fixture = await runnerFixture();
	try {
		await fixture.write(
			'run.ts',
			`import { greet } from './subject';
console.log(JSON.stringify({value:greet('real'),original:greet.toString().includes('toUpperCase')}));`
		);
		for (const environment of [
			{
				...fixture.environment,
				HARNESS_EVIDENCE_DIR: '',
				TAKE_SCREENSHOT: '',
				HARNESS_RUNTIME_PROFILE_DIR: ''
			},
			{ ...fixture.environment, HARNESS_RUNTIME_PROFILE_BOUNDARY: 'benchmark' }
		]) {
			const ran = await fixture.run(['bun', '--preload', preload, 'run.ts'], environment);
			expect(JSON.parse(ran.stdout)).toEqual({ value: 'REAL', original: true });
		}
		expect(await runnerCaptures(fixture.directory)).toEqual([]);
	} finally {
		await fixture.remove();
	}
}, 30_000);

test('unowned source and fixture copies never borrow a registered unit identity', async () => {
	const fixture = await runnerFixture();
	try {
		await fixture.write('other.ts', source);
		await fixture.write('run.ts', "import {greet} from './other'; console.log(greet('real'));\n");
		const ran = await fixture.run(['bun', '--preload', preload, 'run.ts'], fixture.environment);
		expect(ran.stdout.trim()).toBe('REAL');
		expect(await runnerCaptures(fixture.directory)).toEqual([]);
	} finally {
		await fixture.remove();
	}
}, 30_000);

const initializedModules = [
	['Map data', 'export const fields = new Map([["id", 7]]);', "fields.get('id')", '7', 2],
	['nested data', 'export const fields = { nested: { id: 7 } };', 'fields.nested.id', '7', 2],
	[
		'deferred method',
		'export const fields = { read() { return 7; } };',
		'Boolean(fields)',
		'true',
		0
	],
	[
		'nested callback',
		'export const fields = { nested: { read: () => 7 } };',
		'Boolean(fields)',
		'true',
		0
	],
	[
		'Map callback',
		'export const fields = new Map([["read", () => 7]]);',
		'Boolean(fields)',
		'true',
		0
	],
	[
		'imported object callback',
		'import { isAbsolute } from "node:path"; export const fields = { read: isAbsolute };',
		'Boolean(fields)',
		'true',
		0
	],
	[
		'imported Map callback',
		'import { isAbsolute } from "node:path"; export const fields = new Map([["read", isAbsolute]]);',
		'Boolean(fields)',
		'true',
		0
	],
	[
		'getter',
		'export const fields = { get read() { throw Error("not called"); } };',
		'Boolean(fields)',
		'true',
		0
	],
	[
		'nested class',
		'export const fields = { type: class { read() { return 7; } } };',
		'Boolean(fields)',
		'true',
		0
	]
] as const;

test.each(
	initializedModules.map(([label, source, operation, expected, count]) => ({
		label,
		source,
		operation,
		expected,
		count
	}))
)(
	'registered $label modules retain only actual initialization observations',
	async ({ source, operation, expected, count }) => {
		const fixture = await runnerFixture(source, 'fields', 'object');
		try {
			await fixture.write(
				'run.ts',
				`import {fields} from './subject'; console.log(${operation});\n`
			);
			const ran = await fixture.run(['bun', '--preload', preload, 'run.ts'], fixture.environment);
			expect(ran.stdout.trim()).toBe(expected);
			const measurements = await runnerCaptures(fixture.directory);
			expect(measurements, 'data initialization cannot replace deferred operations').toHaveLength(
				count
			);
			if (count) {
				expect(measurements[0].method).toContain('completed source scopes');
				expect(measurements.every((item) => item.samples === 1)).toBe(true);
			}
		} finally {
			await fixture.remove();
		}
	},
	30_000
);

test('failed initialization and type-only modules never gain successful scope observations', async () => {
	for (const source of [
		'export const fields = new Map([["id", 7]]); throw new Error("failed init");\n',
		'export type Fields = { id: number };\n'
	]) {
		const fails = source.includes('throw');
		const fixture = await runnerFixture(
			source,
			fails ? 'fields' : 'Fields',
			fails ? 'Map<string, number>' : 'type'
		);
		try {
			await fixture.write(
				'run.ts',
				`try { await import('./subject'); console.log('ready'); }
catch(error) { console.log(error.message); }\n`
			);
			const ran = await fixture.run(['bun', '--preload', preload, 'run.ts'], fixture.environment);
			expect(ran.stdout.trim()).toBe(source.includes('throw') ? 'failed init' : 'ready');
			expect(await runnerCaptures(fixture.directory)).toEqual([]);
		} finally {
			await fixture.remove();
		}
	}
}, 30_000);
