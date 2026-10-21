import { expect, test } from 'vitest';
import { readFile } from 'node:fs/promises';
import { join } from 'node:path';
import { runnerFixture, runnerCaptures, preload, source } from './support/sourceProfileRunners';

test('normal Vitest imports and its Bun commands capture their own real operations', async () => {
	const fixture = await runnerFixture();
	try {
		await fixture.write(
			'subject.test.ts',
			`import { expect, test } from 'vitest';
import { spawnSync } from 'node:child_process';
import { greet } from './subject';
test('real source operations',()=>{
 expect(greet('direct')).toBe('DIRECT');
 const child=spawnSync('bun',['run.ts'],{encoding:'utf8',env:process.env});
 expect([child.status,child.stdout.trim(),child.stderr]).toEqual([0,'FIXTURE-VALUE','']);
});`
		);
		await fixture.run(['bun', 'x', 'vitest', 'run'], fixture.environment);
		const measurements = await runnerCaptures(fixture.directory);
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
