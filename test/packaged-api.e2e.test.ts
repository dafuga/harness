import { copyFile, cp, mkdir, mkdtemp, readFile, rm, symlink, writeFile } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join, resolve } from 'node:path';
import { expect, test } from 'vitest';
import { kernelArtifacts } from '../src/utils/kernelArtifacts';
import { recordCapture } from '../src/utils/reports-media/record-capture/recordCapture';
import { runCommand } from './support/cli';
import { measureProcess } from './support/cli-measurement/measureProcess';
import { seedConsumerLock } from './support/packagedConsumerLock';
import { expectPackagedSqlite } from './support/packagedSqliteConsumer';
import { expectPackedCliKernel } from './support/packedCliKernel';
import { packedApiConsumer, packedApiConsumerConfig } from './support/packedApiConsumer';

/**
 * Packs Harness and installs the tarball into an empty consumer project, then runs `use` with it.
 * The temp root is removed on every outcome, including a failed pack or install.
 */
async function withPackedConsumer(use: (project: string) => Promise<void>): Promise<void> {
	const root = await mkdtemp(join(tmpdir(), 'harness-api-'));
	try {
		const tarball = join(root, 'harness.tgz');
		await runCommand(
			['bun', 'pm', 'pack', '--ignore-scripts', '--filename', tarball],
			process.cwd()
		);
		const project = join(root, 'consumer');
		await mkdir(project);
		const manifest = {
			name: 'consumer',
			private: true,
			type: 'module',
			dependencies: { '@dafuga01/harness': `file:${tarball}` },
			devDependencies: { typescript: '^5.8.3', '@types/node': '^22.15.3' }
		};
		await writeFile(join(project, 'package.json'), JSON.stringify(manifest));
		await writeFile(join(project, 'tsconfig.json'), JSON.stringify(packedApiConsumerConfig));
		await writeFile(join(project, 'consumer.ts'), packedApiConsumer);
		await seedConsumerLock({ project, tarball, consumer: manifest });
		await runCommand(['bun', 'install', '--prefer-offline'], project);
		await use(project);
	} finally {
		await rm(root, { recursive: true, force: true });
	}
}

/** Runs both tsc invocations and returns what they reported, after every assertion has passed. */
async function expectTypes(project: string): Promise<{
	clean: { exitCode: number; output: string };
	invalid: { exitCode: number; diagnostic: string | undefined };
}> {
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
	return {
		clean: { exitCode: typecheck.exitCode, output: typecheck.stdout + typecheck.stderr },
		invalid: { exitCode: bad.exitCode, diagnostic: bad.stdout.match(/TS\d+/)?.[0] }
	};
}

/**
 * Records the values the packed checks observed. Called only after every assertion above has passed,
 * so the capture never claims a pass that did not happen.
 */
function recordPackedAssertions(
	types: Awaited<ReturnType<typeof expectTypes>>,
	printed: Record<string, unknown>
): void {
	const runners = Object.entries(printed).map(([runner, value]) => {
		const result = value as Record<string, unknown>;
		return {
			runner,
			kinds: result.kinds,
			invalidErrors: result.invalidErrors,
			responses: result.responses
		};
	});
	recordCapture(
		{
			evidence: 'packed-assertions',
			kind: 'assertions',
			state: 'packed',
			file: 'packed-assertions.json',
			mediaType: 'application/json',
			note: 'Observed values that passed the packed consumer assertions under Bun and Node, with the tsc results.'
		},
		JSON.stringify({ typeCheck: types, runners }, null, 2)
	);
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
	await withPackedConsumer(async (project) => {
		const types = await expectTypes(project);
		await expectPackagedSqlite(project);
		await expectPackedCliKernel(project);
		const manifest = await readFile('specification/units/function.commit-identity.json', 'utf8');
		const native = kernelArtifacts().native ?? '';
		const expected = { ok: true, output: { contract: 'impact-kernel/1' } };
		const printed: Record<string, unknown> = {};
		for (const runner of ['bun', 'node']) {
			const run = await measureProcess(
				{
					units: ['module.index', 'module.resources', 'module.verification', 'module.projects'],
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
				projects: { schema: 1, status: 'empty', projects: [] },
				id: 'function.commit-identity',
				errors: [],
				invalidErrors: ['function.commit-identity: contract input unsupported has unknown type'],
				scenario: true,
				record: true,
				tolerance: 0.05,
				kinds: ['module', 'wasm', 'process', 'http'],
				responses: [expected, expected, expected, expected],
				cli: 'undefined',
				rootExports: expect.arrayContaining([
					'componentManifestSchema',
					'impactKernel',
					'readProjectList'
				])
			});
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
		recordPackedAssertions(types, printed);
	});
}, 240_000);
