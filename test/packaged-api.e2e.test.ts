import { copyFile, cp, mkdir, mkdtemp, readFile, rm, symlink, writeFile } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join, resolve } from 'node:path';
import { expect, test } from 'vitest';
import { kernelArtifacts } from '../src/utils/kernelArtifacts';
import { recordCapture } from '../src/utils/record-capture/recordCapture';
import { runCommand } from './support/cli';
import { measureProcess } from './support/cli-measurement/measureProcess';
import { expectPackagedSqlite } from './support/packagedSqliteConsumer';

const consumer = `
import {
	componentManifestSchema,
	scenarioManifestSchema,
	verificationRecordSchema,
	performanceTolerance,
	ComponentManifestValidator,
	type ComponentManifest,
	type ScenarioManifest,
	type VerificationRecord
} from '@dafuga01/harness/contracts';
import {
	HttpRuntimeAdapter,
	ModuleRuntimeAdapter,
	ProcessRuntimeAdapter,
	WasmRuntimeAdapter,
	UnitRuntimeService,
	RuntimeServerService,
	impactKernel,
	kernelArtifacts,
	type RuntimeRequest,
	type RuntimeResponse,
	type UnitRuntime,
	type ExecutionTarget
} from '@dafuga01/harness/runtime';
import { resourceConfigSchema, resourceRequestSchema, type ResourceRequest } from '@dafuga01/harness/resources';
import * as root from '@dafuga01/harness';
import { consolePolicy, consoleAccess, consoleRoutePath } from '@dafuga01/harness/console';
const sdkPolicy = consolePolicy({ mode: 'loopback', bind: '127.0.0.1' });
const sdkAccess = consoleAccess({ policy: sdkPolicy, data: { json: async () => undefined, media: async () => undefined } });
const sdkRoute: string = consoleRoutePath({ branch: null, commit: 'a', view: 'map' });
void [sdkAccess, sdkRoute];
const resourceRequest: ResourceRequest = resourceRequestSchema.parse({ priority: 'agent-test' });

const request: RuntimeRequest = { operation: 'version' };
const manifest: ComponentManifest = componentManifestSchema.parse(JSON.parse(process.argv[2]));
const scenario: ScenarioManifest | undefined = scenarioManifestSchema.safeParse({}).data;
const record: VerificationRecord | undefined = verificationRecordSchema.safeParse({}).data;
const errors: string[] = new ComponentManifestValidator().validate(manifest, manifest.id + '.json').errors;
const wasm: ExecutionTarget = { kind: 'wasm', entry: kernelArtifacts().wasm ?? '' };
const service = new UnitRuntimeService(process.cwd());
const served = await new RuntimeServerService().serve(service.forTarget(wasm), { port: 0 });
const runtimes: UnitRuntime[] = [
	new ModuleRuntimeAdapter(impactKernel),
	new WasmRuntimeAdapter(wasm.entry),
	new ProcessRuntimeAdapter({ command: process.argv[3] }),
	new HttpRuntimeAdapter(served.url)
];
const responses: RuntimeResponse[] = [];
for (const runtime of runtimes) responses.push(await runtime.invoke(request));
await Promise.all(runtimes.map((runtime) => runtime.close()));
await served.close();
console.log(JSON.stringify({
	resources: { request: resourceRequest.priority, reserve: resourceConfigSchema.parse({}).cpuReservePercent },
	id: manifest.id,
	errors,
	scenario: scenario === undefined,
	record: record === undefined,
	tolerance: performanceTolerance,
	kinds: runtimes.map((runtime) => runtime.kind),
	responses,
	rootExports: Object.keys(root).sort(),
	cli: typeof (globalThis as { harnessCliRan?: boolean }).harnessCliRan
}));
`;

const tsconfig = {
	compilerOptions: {
		target: 'ES2022',
		module: 'ESNext',
		moduleResolution: 'Bundler',
		strict: true,
		noEmit: true,
		skipLibCheck: false,
		types: ['node']
	},
	include: ['consumer.ts']
};

/** Packs Harness and installs the tarball into an empty consumer project. */
async function packedConsumer(): Promise<{ root: string; project: string }> {
	const root = await mkdtemp(join(tmpdir(), 'harness-api-'));
	const tarball = join(root, 'harness.tgz');
	await runCommand(['bun', 'pm', 'pack', '--ignore-scripts', '--filename', tarball], process.cwd());
	const project = join(root, 'consumer');
	await mkdir(project);
	const dependencies = { '@dafuga01/harness': `file:${tarball}` };
	const devDependencies = { typescript: '^5.8.3', '@types/node': '^22.15.3' };
	await writeFile(
		join(project, 'package.json'),
		JSON.stringify({
			name: 'consumer',
			private: true,
			type: 'module',
			dependencies,
			devDependencies
		})
	);
	await writeFile(join(project, 'tsconfig.json'), JSON.stringify(tsconfig));
	await writeFile(join(project, 'consumer.ts'), consumer);
	await runCommand(['bun', 'install'], project);
	return { root, project };
}

async function expectTypes(project: string): Promise<void> {
	const typecheck = await runCommand(['bun', 'x', 'tsc', '-p', '.'], project, false);
	expect(typecheck.stdout + typecheck.stderr).toBe('');
	expect(typecheck.exitCode).toBe(0);
	await writeFile(
		join(project, 'bad.ts'),
		"import type { ComponentManifest } from '@dafuga01/harness/contracts';\nexport const bad: ComponentManifest = { id: 1 };\n"
	);
	const options = ['--noEmit', '--strict', '--moduleResolution', 'Bundler', '--module', 'ESNext'];
	const bad = await runCommand(['bun', 'x', 'tsc', ...options, 'bad.ts'], project, false);
	expect(bad.exitCode).not.toBe(0);
	expect(bad.stdout).toContain('TS2');
}

test('public API type build retains configured entry paths across owned workspaces', async () => {
	const root = await mkdtemp(join(tmpdir(), 'harness-api-types-'));
	try {
		for (const path of ['src', 'scripts', 'packages/reports/src'])
			await cp(resolve(path), join(root, path), { recursive: true });
		for (const path of ['package.json', 'tsconfig.json', 'tsconfig.api.json'])
			await copyFile(resolve(path), join(root, path));
		await symlink(resolve('node_modules'), join(root, 'node_modules'), 'dir');
		const built = await measureProcess(
			{
				units: ['script.build-api'],
				workload: 'public-api-declaration-build',
				target: 'process',
				command: ['bun', 'scripts/build-api.ts', '--types-only'],
				cwd: root,
				expectSuccess: false
			},
			runCommand
		);
		expect(
			built.exitCode,
			`public API declaration build succeeds: ${built.stdout}${built.stderr}`
		).toBe(0);
		const manifest = JSON.parse(await readFile(join(root, 'package.json'), 'utf8'));
		for (const [name, entry] of Object.entries(manifest.exports)) {
			if (
				name === './console-ui' ||
				typeof entry !== 'object' ||
				entry === null ||
				!('types' in entry)
			)
				continue;
			expect(await readFile(join(root, String(entry.types)), 'utf8'), name).not.toBe('');
		}
	} finally {
		await rm(root, { recursive: true, force: true });
	}
}, 60000);

test('a packed consumer imports typed contracts and calls real adapters without the CLI', async () => {
	const { root, project } = await packedConsumer();
	await expectTypes(project);
	await expectPackagedSqlite(project);
	const manifest = await readFile(resolve('specification/units/function.stable-json.json'), 'utf8');
	const native = kernelArtifacts().native ?? '';
	const expected = { ok: true, output: { contract: 'impact-kernel/1' } };
	const printed: Record<string, unknown> = {};
	for (const runner of ['bun', 'node']) {
		const run = await measureProcess(
			{
				units: ['module.index', 'module.resources'],
				workload: `cold-${runner}-packed-sdk`,
				target: 'module',
				command: [runner, 'consumer.ts', manifest, native],
				cwd: project
			},
			runCommand
		);
		const result = JSON.parse(run.stdout) as Record<string, unknown>;
		printed[runner] = result;
		expect(result, runner).toMatchObject({
			resources: { request: 'agent-test', reserve: 10 },
			id: 'function.stable-json',
			errors: [],
			scenario: true,
			record: true,
			tolerance: 0.05,
			kinds: ['module', 'wasm', 'process', 'http'],
			responses: [expected, expected, expected, expected],
			cli: 'undefined'
		});
		expect(result.rootExports).toEqual(
			expect.arrayContaining(['componentManifestSchema', 'impactKernel'])
		);
		expect(run.stdout).not.toContain('Usage: harness');
	}
	// Under verification, what the consumer printed is the evidence of the packed state.
	recordCapture(
		{
			evidence: 'consumer-output',
			kind: 'output',
			state: 'packed',
			file: 'consumer-output.json',
			mediaType: 'application/json',
			note: 'Printed by the consumer project under each runtime after it installed the packed tarball.'
		},
		JSON.stringify(printed, null, 2)
	);
	await rm(root, { recursive: true, force: true });
}, 240_000);
