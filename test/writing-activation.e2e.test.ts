import { dirname, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import { afterAll, beforeAll, expect, test } from 'vitest';
import { runCommand } from './support/cli';
import { baselineRepo, cloneRepo, type VerifyRepo } from './support/verifyRepo';

let baseline: VerifyRepo;
beforeAll(async () => {
	baseline = await baselineRepo();
}, 120_000);
afterAll(() => baseline.dispose());

/** Declares one version of the writing limits in the verification config of the working tree. */
async function declare(repo: VerifyRepo, writing: 1 | 2): Promise<void> {
	const config = await repo.json<Record<string, unknown>>('harness.verify.json');
	await repo.write('harness.verify.json', JSON.stringify({ ...config, writing }));
}

test('a repository that declares writing 2 holds its commit messages, staged and stored', async () => {
	const repo = await cloneRepo(baseline);
	const cli = resolve(dirname(fileURLToPath(import.meta.url)), '../src/index.ts');
	expect((await repo.run(['hooks', 'install', '--command', `bun ${cli}`])).exitCode).toBe(0);
	const identity = ['-c', 'user.name=Fixture', '-c', 'user.email=fixture@harness.invalid'];
	const commit = (subject: string, more: string[] = []) =>
		runCommand(
			['git', ...identity, 'commit', '--allow-empty', ...more, '-m', subject],
			repo.root,
			false
		);
	const long = `feat: ${'s'.repeat(67)}`;
	// Declared in the working tree alone, the limits are not part of what is committed.
	await declare(repo, 2);
	expect((await commit(long)).exitCode).toBe(0);
	// Staged, they hold the very commit that adopts them.
	await repo.git(['add', 'harness.verify.json']);
	const refused = await commit(long);
	expect([
		refused.exitCode === 0,
		refused.stderr.includes('subject has 73 characters; the limit is 72.')
	]).toEqual([false, true]);
	expect((await commit('chore: adopt the second writing version')).exitCode).toBe(0);
	// Past the hook the commit is made, and the verification of it does not pass.
	expect((await commit(long, ['--no-verify'])).exitCode).toBe(0);
	const head = (await repo.git(['rev-parse', 'HEAD'])).slice(0, 12);
	const verified = await repo.verify();
	const messages = verified.record.failures.filter((failure) => failure.startsWith('commit '));
	// The earlier long message was stored before the limits were: only the later one is held.
	expect([verified.record.status, messages]).toEqual([
		'failed',
		[`commit ${head}: subject has 73 characters; the limit is 72.`]
	]);
	await repo.dispose();
}, 240_000);
