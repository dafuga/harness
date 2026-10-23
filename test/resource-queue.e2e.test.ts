import { createRequire } from 'node:module';
import { measureProcess } from './support/cli-measurement/measureProcess';
import { spawn } from 'node:child_process';
import { existsSync, mkdtempSync, readFileSync, rmSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { setTimeout as delay } from 'node:timers/promises';
import { afterEach, expect, test } from 'vitest';
import { ResourceQueueRepository } from '../src/services/execution-runtimes/resource-queue-service/ResourceQueueRepository';
import { saveResourceConfig } from '../src/utils/execution-runtimes/resourceConfig';
import { runCommand } from './support/cli';
import { config, snapshot } from './support/resourceFixture';
const homes: string[] = [];
afterEach(() => homes.splice(0).forEach((p) => rmSync(p, { recursive: true, force: true })));
function home() {
	const path = mkdtempSync(join(tmpdir(), 'resource-processes-'));
	homes.push(path);
	saveResourceConfig(config, path);
	return path;
}
const serviceFile = new URL(
	'../src/services/execution-runtimes/ResourceQueueService.ts',
	import.meta.url
).href;
const typeFile = new URL('../src/core/execution-runtimes/resourceTypes.ts', import.meta.url).href;
const commandFile = new URL('../src/utils/execution-runtimes/resourceCommand.ts', import.meta.url)
	.href;
const setup = `const {ResourceQueueService}=await import(${JSON.stringify(serviceFile)});const {resourceRequestSchema}=await import(${JSON.stringify(typeFile)});const fs=require('node:fs'),path=require('node:path');const home=process.env.RESOURCE_FIXTURE_HOME;const service=new ResourceQueueService({home,env:{},monitor:{sample:async()=>({...${JSON.stringify(snapshot())},sampledAt:Date.now()})}});`;
const worker =
	setup +
	`
const role=process.env.RESOURCE_FIXTURE_ROLE;
await service.run(resourceRequestSchema.parse({priority:role==='blocker'?'environment':role,cpus:role==='blocker'?9:6}),async()=>{
 fs.appendFileSync(path.join(home,'events'),JSON.stringify({role,event:'start'})+'\\n');
 if(role==='blocker') {while(!fs.existsSync(path.join(home,'release'))) await Bun.sleep(10);} else await Bun.sleep(100);
 fs.appendFileSync(path.join(home,'events'),JSON.stringify({role,event:'end'})+'\\n');
});service.close();`;
async function until(condition: () => boolean) {
	const began = Date.now();
	while (!condition()) {
		if (Date.now() - began > 10000) throw new Error('Fixture did not reach its barrier');
		await delay(10);
	}
}
test('separate native processes share atomic reservations and honor agent-test, coding, environment order', async () => {
	const path = home(),
		db = new ResourceQueueRepository(path);
	const launch = (role: string) =>
		runCommand(['bun', '-e', worker], process.cwd(), false, {
			RESOURCE_FIXTURE_HOME: path,
			RESOURCE_FIXTURE_ROLE: role
		});
	const blocker = launch('blocker');
	await until(() => existsSync(join(path, 'events')));
	const environment = launch('environment');
	await until(() => db.all().length === 2);
	const coding = launch('coding');
	await until(() => db.all().length === 3);
	const agent = launch('agent-test');
	await until(() => db.all().length === 4);
	writeFileSync(join(path, 'release'), '');
	try {
		const results = await Promise.all([blocker, environment, coding, agent]);
		results.forEach((r) => expect(r.exitCode, r.stderr).toBe(0));
		const events = readFileSync(join(path, 'events'), 'utf8')
			.trim()
			.split('\n')
			.map((l) => JSON.parse(l));
		expect(events.filter((e) => e.event === 'start').map((e) => e.role)).toEqual([
			'blocker',
			'agent-test',
			'coding',
			'environment'
		]);
		let active = 0;
		for (const event of events) {
			active += event.event === 'start' ? 1 : -1;
			expect(active).toBeLessThanOrEqual(1);
		}
		expect(active).toBe(0);
		expect(db.all()).toEqual([]);
	} finally {
		db.close();
	}
}, 20000);
test('managed coding commands preserve interactive stdin, stdout and stderr without leaking reservations', async () => {
	const path = home();
	const script =
		setup +
		`const {resourceCommand}=await import(${JSON.stringify(commandFile)});const code=await service.run(resourceRequestSchema.parse({}),context=>resourceCommand([process.execPath,'-e','let text="";process.stdin.on("data",data=>text+=data);process.stdin.on("end",()=>{console.log(JSON.stringify({echo:text}));console.error("fixture diagnostic");});'],context));service.close();process.exitCode=code;`;
	const child = spawn('bun', ['-e', script], {
		env: { ...process.env, RESOURCE_FIXTURE_HOME: path },
		stdio: 'pipe'
	});
	let out = '',
		err = '';
	child.stdout.on('data', (c) => (out += c));
	child.stderr.on('data', (c) => (err += c));
	child.stdin.end('fixture input');
	const exit = await new Promise((resolve) => child.once('close', resolve));
	expect(exit, err).toBe(0);
	expect(JSON.parse(out)).toEqual({ echo: 'fixture input' });
	expect(err).toContain('fixture diagnostic');
	const db = new ResourceQueueRepository(path);
	try {
		expect(db.all()).toEqual([]);
	} finally {
		db.close();
	}
}, 15000);

test('the Node CommonJS desktop bundle shares the Bun SQLite reservation protocol', async () => {
	const path = home(),
		bundle = join(path, 'resources.cjs');
	const built = await runCommand(
		[
			'bun',
			'build',
			'src/lib/execution-runtimes/resources.ts',
			'--target',
			'node',
			'--format',
			'cjs',
			'--outfile',
			bundle
		],
		process.cwd()
	);
	expect(built.exitCode, built.stderr).toBe(0);
	const runtimes: Array<{ command: string; env: Record<string, string>; label: string }> = [
		{ command: 'node', env: {}, label: 'Node' },
		{
			command: createRequire(import.meta.url)('electron') as string,
			env: { ELECTRON_RUN_AS_NODE: '1' },
			label: 'Electron'
		}
	];
	for (const runtime of runtimes) await sharedRuntimeReservation(path, bundle, runtime);
}, 15000);

async function sharedRuntimeReservation(
	path: string,
	bundle: string,
	runtime: { command: string; env: Record<string, string>; label: string }
) {
	const bun = await runCommand(
		[
			'bun',
			'-e',
			setup +
				`service.queue.add({...resourceRequestSchema.parse({cpus:8}),id:crypto.randomUUID(),ownerPid:process.pid,ownerStarted:'fixture',state:'running',createdAt:Date.now(),heartbeatAt:Date.now(),notice:null});service.close();`
		],
		process.cwd(),
		true,
		{ RESOURCE_FIXTURE_HOME: path }
	);
	expect(bun.exitCode, bun.stderr).toBe(0);
	const code = `const {ResourceQueueService}=require(${JSON.stringify(bundle)});const q=new ResourceQueueService({home:${JSON.stringify(path)},env:{}});const jobs=q.queue.all();if(jobs.length!==1||jobs[0].cpus!==8)throw new Error('Bun reservation missing');q.queue.remove(jobs[0].id);q.close();console.log('shared reservation cleared');`;
	const node = await measureProcess(
		{
			units: ['module.resources'],
			workload: `cold-${runtime.label.toLowerCase()}-resources-entry`,
			target: 'module',
			command: [runtime.command, '-e', code],
			cwd: process.cwd(),
			env: runtime.env,
			expectSuccess: false
		},
		runCommand
	);
	expect(node.exitCode, node.stderr).toBe(0);
	expect(node.stdout).toContain('shared reservation cleared');
	const db = new ResourceQueueRepository(path);
	try {
		expect(db.all()).toEqual([]);
	} finally {
		db.close();
	}
}
