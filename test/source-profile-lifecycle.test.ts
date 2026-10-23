import type { Fixture } from './source-profile-lifecycle.test.types';
export type { Fixture } from './source-profile-lifecycle.test.types';
import { mkdtemp, rm, writeFile } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { pathToFileURL } from 'node:url';
import { expect, test } from 'vitest';
import { preload, runnerCaptures, runnerFixture } from './support/sourceProfileRunners';

async function foreignProgram(fixture: Fixture, source: string, environment = fixture.environment) {
	const root = await mkdtemp(join(tmpdir(), 'harness-foreign-runner-'));
	try {
		const entry = join(root, 'run.ts');
		await writeFile(entry, source);
		return await fixture.run(['bun', '--preload', preload, entry], environment);
	} finally {
		await rm(root, { recursive: true, force: true });
	}
}
const cacheProbe = `Object.keys(require.cache).some(path=>path.includes('/typescript/lib/'))`;

test('unrelated foreign processes never load the source compiler', async () => {
	const fixture = await runnerFixture();
	try {
		const ran = await foreignProgram(
			fixture,
			`console.log(JSON.stringify({value:7,compilerLoaded:${cacheProbe}}));`
		);
		expect(JSON.parse(ran.stdout)).toEqual({ value: 7, compilerLoaded: false });
		expect(await runnerCaptures(fixture.directory)).toEqual([]);
	} finally {
		await fixture.remove();
	}
}, 30_000);

test('foreign entries still profile registered imports when work begins', async () => {
	const fixture = await runnerFixture();
	try {
		const subject = pathToFileURL(join(fixture.root, 'subject.ts')).href;
		const ran = await foreignProgram(
			fixture,
			`import {greet} from ${JSON.stringify(subject)};
console.log(JSON.stringify({value:greet('real'),compilerLoaded:${cacheProbe}}));`
		);
		expect(JSON.parse(ran.stdout)).toEqual({ value: 'REAL', compilerLoaded: true });
		const measurements = await runnerCaptures(fixture.directory);
		expect(measurements.filter((item) => item.unit === 'function.runner-fixture')).toHaveLength(2);
	} finally {
		await fixture.remove();
	}
}, 30_000);

test('type imports and live side-effect imports retain normal Bun behavior', async () => {
	const fixture = await runnerFixture(`import { Shape, marker } from './types';
import './effect';
export function greet(value: Shape): string { return [marker,value.name,globalThis.fixtureEffect].join(':'); }`);
	try {
		await fixture.write(
			'types.ts',
			`export interface Shape { name: string }\nexport const marker='live';\n`
		);
		await fixture.write('effect.ts', `globalThis.fixtureEffect=true;\n`);
		await fixture.write(
			'run.ts',
			`import {greet} from './subject'; console.log(greet({name:'real'}));\n`
		);
		const ordinary = await fixture.run(['bun', 'run.ts'], fixture.environment);
		expect(ordinary.stdout.trim()).toBe('live:real:true');
		const observed = await fixture.run(
			['bun', '--preload', preload, 'run.ts'],
			fixture.environment
		);
		expect(observed.stdout).toBe(ordinary.stdout);
		expect(await runnerCaptures(fixture.directory)).toHaveLength(2);
	} finally {
		await fixture.remove();
	}
}, 30_000);

test('declaration collection never substitutes for runtime execution evidence', async () => {
	const fixture = await runnerFixture(
		'export const fields=new Map([["id",7]]);',
		'fields',
		'Map<string,number>'
	);
	try {
		await fixture.write(
			'subject.test.ts',
			`import {expect,test} from 'vitest';
import {fields} from './subject'; test('real data',()=>expect(fields.size).toBe(1));`
		);
		const script = `import {createVitest} from 'vitest/node';
const context=await createVitest('test',{watch:false,run:true});
try{const result=await context.collect(['subject.test.ts']);
if(result.unhandledErrors.length)throw new AggregateError(result.unhandledErrors);
const transformed=await context.vite.transformRequest('/subject.ts',{ssr:true});
console.log(JSON.stringify({declared:result.testModules.length,observed:transformed.code.includes('__harnessWatch_')}));
}finally{await context.close();}`;
		const collected = await fixture.run(['node', '--input-type=module', '--eval', script], {
			...fixture.environment,
			HARNESS_COLLECT_FILES: '["subject.test.ts"]'
		});
		expect(collected.stdout).toContain('"declared":1,"observed":false');
		expect(
			await runnerCaptures(fixture.directory),
			'declaration-only collection is not a runtime profile'
		).toEqual([]);
		await fixture.run(['bun', 'x', 'vitest', 'run'], {
			...fixture.environment,
			HARNESS_COLLECT_FILES: ''
		});
		expect(await runnerCaptures(fixture.directory)).toHaveLength(2);
	} finally {
		await fixture.remove();
	}
}, 30_000);

test('explicit benchmark children keep user flags and remove only the owned preload', async () => {
	const fixture = await runnerFixture();
	try {
		await fixture.write(
			'child.ts',
			`console.log(JSON.stringify({options:process.env.BUN_OPTIONS,boundary:process.env.HARNESS_RUNTIME_PROFILE_BOUNDARY}));\n`
		);
		await fixture.write(
			'run.ts',
			`const child=Bun.spawnSync(['bun','child.ts']);
if(child.exitCode!==0)throw Error(new TextDecoder().decode(child.stderr));
console.log(new TextDecoder().decode(child.stdout).trim());\n`
		);
		const ran = await fixture.run(['bun', '--preload', preload, 'run.ts'], {
			...fixture.environment,
			HARNESS_RUNTIME_PROFILE_BOUNDARY: 'benchmark',
			BUN_OPTIONS: `--smol --preload=${preload}`
		});
		expect(JSON.parse(ran.stdout)).toEqual({ options: '--smol', boundary: 'benchmark' });
		expect(await runnerCaptures(fixture.directory)).toEqual([]);
	} finally {
		await fixture.remove();
	}
}, 30_000);
