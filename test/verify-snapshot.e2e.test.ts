import { spawn } from 'node:child_process';
import { existsSync } from 'node:fs';
import { readFile, rm, writeFile } from 'node:fs/promises';
import { createHash } from 'node:crypto';
import { join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { afterAll, beforeAll, expect, test } from 'vitest';
import { fixtureSources } from './support/verifyFixture';
import { baselineRepo, cloneRepo, type VerifyRepo } from './support/verifyRepo';
import { ownEnvironment } from './support/cli';

let baseline: VerifyRepo;
beforeAll(async () => {
	baseline = await baselineRepo();
}, 120_000);
afterAll(() => baseline.dispose());

const gained = (path: string) => `snapshot gained an undeclared file during verification: ${path}`;
const mutated = (path: string) => `snapshot mutated during verification: ${path}`;

/** Changes and explains a shared function, then verifies with a misbehaving check. */
async function verifyWith(
	env: Record<string, string>,
	prepare?: (repo: VerifyRepo) => Promise<void>,
	args: string[] = []
) {
	const repo = await cloneRepo(baseline);
	await prepare?.(repo);
	await repo.change('src/utils/slugify.ts', (source) =>
		source.replace('toLowerCase', 'toUpperCase')
	);
	const outcome = await repo.verify(args, env);
	return { repo, ...outcome };
}

async function declareOutputs(repo: VerifyRepo, outputs: string[]): Promise<void> {
	const config = JSON.parse(fixtureSources['harness.verify.json']) as object;
	await repo.write('harness.verify.json', JSON.stringify({ ...config, outputs }));
	await repo.commit('chore: declare generated outputs');
}

test('a check that adds a new source file fails the snapshot gate and keeps its record', async () => {
	const path = 'src/utils/untracked-generated.ts';
	const { repo, exitCode, record, directory } = await verifyWith({ FIXTURE_MUTATE: path });
	expect([exitCode, record.status]).toEqual([1, 'failed']);
	expect(record.failures).toEqual([gained(path)]);
	expect(record.gates).toMatchObject({ snapshot: 'failed', tests: 'passed', scenarios: 'passed' });
	expect(existsSync(join(directory, 'record.json'))).toBe(true);
	expect(existsSync(join(repo.root, path))).toBe(false);
	await repo.dispose();

	for (const elsewhere of [
		'vitest.config.ts',
		'generated/helper.ts',
		'test/services/extra.test.ts'
	]) {
		const other = await verifyWith({ FIXTURE_MUTATE: elsewhere });
		expect([other.exitCode, other.record.failures]).toEqual([1, [gained(elsewhere)]]);
		await other.repo.dispose();
	}
}, 300_000);

test('removing or renaming tracked source fails the snapshot gate', async () => {
	const removed = await verifyWith({ FIXTURE_REMOVE: 'src/utils/clock.ts' });
	expect([removed.exitCode, removed.record.failures]).toEqual([1, [mutated('src/utils/clock.ts')]]);
	expect(existsSync(join(removed.repo.root, 'src/utils/clock.ts'))).toBe(true);
	await removed.repo.dispose();

	const renamed = await verifyWith({ FIXTURE_RENAME: 'src/utils/clock.ts:src/utils/timepiece.ts' });
	expect(renamed.exitCode).toBe(1);
	expect(renamed.record.failures).toEqual([
		mutated('src/utils/clock.ts'),
		gained('src/utils/timepiece.ts')
	]);
	await renamed.repo.dispose();
}, 240_000);

test('a file that one check adds and a later check removes is still caught', async () => {
	const path = 'src/utils/transient.ts';
	const { repo, exitCode, record } = await verifyWith({
		FIXTURE_ADD_EARLY: path,
		FIXTURE_REMOVE: path
	});
	expect([exitCode, record.failures]).toEqual([1, [gained(path)]]);
	await repo.dispose();
}, 180_000);

test('a declared output may be written, and nothing else may be', async () => {
	expect((await baseline.run(['verify', 'run', '--help'])).stdout).toContain('--retain-artifact');
	const declared = (repo: VerifyRepo) => declareOutputs(repo, ['build/']);
	const artifactArgs = ['--retain-artifact', 'build/out.js'];
	const built = await verifyWith({ FIXTURE_MUTATE: 'build/out.js' }, declared, artifactArgs);
	try {
		expect([built.exitCode, built.record.failures]).toEqual([0, []]);
		expect(built.record.gates).toMatchObject({ snapshot: 'passed', artifact: 'passed' });
		const output = join(built.directory, 'artifacts/export');
		const bytes = await readFile(output);
		expect(bytes.length).toBeGreaterThan(0);
		expect(built.record.retainedArtifact).toEqual({
			sourcePath: 'build/out.js',
			path: 'artifacts/export',
			bytes: bytes.length,
			sha256: createHash('sha256').update(bytes).digest('hex')
		});
		const check = ['verify', 'check', '--record', built.record.id, '--json'];
		expect((await built.repo.run(check)).exitCode).toBe(0);
		await writeFile(output, 'tampered fixture');
		expect((await built.repo.run(check)).exitCode).toBe(1);
	} finally {
		await built.repo.dispose();
	}

	const missing = await verifyWith({}, declared, artifactArgs);
	try {
		expect([missing.exitCode, missing.record.gates?.artifact]).toEqual([1, 'failed']);
		expect(existsSync(join(missing.directory, 'artifacts/export'))).toBe(false);
		expect(missing.record.retainedArtifact).toBeUndefined();
	} finally {
		await missing.repo.dispose();
	}

	await expectCancelledArtifactBuild(artifactArgs);

	const beside = await verifyWith({ FIXTURE_MUTATE: 'builds/out.js' }, declared);
	expect([beside.exitCode, beside.record.failures]).toEqual([1, [gained('builds/out.js')]]);
	await beside.repo.dispose();
	const source = await verifyWith({ FIXTURE_MUTATE: 'src/utils/extra.ts' }, declared);
	expect([source.exitCode, source.record.failures]).toEqual([1, [gained('src/utils/extra.ts')]]);
	await source.repo.dispose();
}, 300_000);

async function expectCancelledArtifactBuild(artifactArgs: string[]): Promise<void> {
	const repo = await cloneRepo(baseline);
	const marker = join(repo.root, '.git', 'setup-process.json');
	const cli = fileURLToPath(new URL('../src/index.ts', import.meta.url));
	let pid: number | undefined;
	let snapshot: string | undefined;
	try {
		const config = await repo.json<{ setup: unknown[] }>('harness.verify.json');
		const report = `printf '{"pid":%s,"snapshot":"%s"}' "$!" "$(pwd -P)" > "${marker}.tmp"`;
		await repo.write(
			'harness.verify.json',
			JSON.stringify({
				...config,
				outputs: ['build/'],
				setup: [
					...config.setup,
					{ command: `sleep 120 & ${report} && mv "${marker}.tmp" "${marker}"; wait` }
				]
			})
		);
		await repo.commit('chore: exercise cancellable export setup');
		const child = spawn('bun', [cli, 'verify', 'run', '--json', ...artifactArgs], {
			cwd: repo.root,
			env: ownEnvironment(),
			stdio: 'ignore'
		});
		const closed = new Promise((resolve) => child.once('close', resolve));
		try {
			await expect
				.poll(
					async () => {
						const state = await readFile(marker, 'utf8').catch(() => '');
						if (!state) return false;
						({ pid, snapshot } = JSON.parse(state));
						return !!pid && processAlive(pid) && !!snapshot && existsSync(snapshot);
					},
					{ timeout: 15_000 }
				)
				.toBe(true);
			child.kill('SIGTERM');
			await expect
				.poll(() => [processAlive(pid!), existsSync(snapshot!)], {
					timeout: 10_000
				})
				.toEqual([false, false]);
			expect(await closed).not.toBe(0);
		} finally {
			if (pid && processAlive(pid)) process.kill(pid, 'SIGTERM');
			if (child.exitCode === null && child.signalCode === null) child.kill('SIGTERM');
			await closed;
		}
	} finally {
		if (snapshot) await rm(snapshot, { recursive: true, force: true });
		await repo.dispose();
	}
}

function processAlive(pid: number): boolean {
	try {
		process.kill(pid, 0);
		return true;
	} catch {
		return false;
	}
}

test('an output declaration cannot cover tracked source', async () => {
	const broad = await verifyWith({ FIXTURE_MUTATE: 'src/utils/extra.ts' }, (repo) =>
		declareOutputs(repo, ['src/'])
	);
	expect([broad.exitCode, broad.record.status]).toEqual([1, 'failed']);
	expect(broad.record.failures).toContainEqual(
		expect.stringMatching(
			/^harness\.verify\.json declares output "src\/", which covers tracked files such as src\/\S+; outputs may only name generated paths$/
		)
	);
	expect(broad.record.gates).toMatchObject({ snapshot: 'failed' });
	expect(broad.record.tests).toEqual([]);
	await broad.repo.dispose();
}, 180_000);
