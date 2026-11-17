import { test } from 'vitest';
import { expect } from '../verificationExpect';
import { recordExampleCases } from '../support/recordExampleCases';
import { withTempDir, withTempRepo } from '../support/temporary';
import { GitAdapter } from '../../src/adapters/git-source-history/GitAdapter';
import { GitCommandError } from '../../src/adapters/git-source-history/GitAdapter.types';
import type { GitRunOptions, GitResult } from '../../src/adapters/git-source-history/GitAdapter.types';
import { gitVerb, gitDeadline } from '../../src/adapters/git-source-history/git-adapter/gitDeadline';

const MISSING_REF = ['rev-parse', '--verify', 'refs/heads/missing'];
const STDIN_TEXT = 'feat: add bounded Git support\n';
const SHA_PATTERN = /^[0-9a-f]{40}$/;
const AUTHOR_ENV: Record<string, string> = {
	GIT_AUTHOR_NAME: 'Example Author',
	GIT_AUTHOR_EMAIL: 'author@example.invalid',
	GIT_AUTHOR_DATE: '1700000000 +0000'
};

function meta(symbol: string, state: string) {
	return { unitId: 'adapter.git', symbol, state, evidence: 'examples-cases', file: `${state}.json` };
}

test('Runs git and returns trimmed stdout', async () => {
	await withTempRepo(async (repository) => {
		const adapter = new GitAdapter(repository.root);
		const args = ['rev-parse', '--is-inside-work-tree'];
		const output = await adapter.run(args);
		expect(output).toBe('true');
		recordExampleCases(meta('GitAdapter.run', 'runs-git-and-returns-trimmed-stdout'), [
			{ name: 'work tree probe returns trimmed true', input: args, output }
		]);
	});
}, 20_000);

test('Probes the repository without failing', async () => {
	await withTempRepo(async (repository) => {
		const adapter = new GitAdapter(repository.root);
		const missing = await adapter.attempt(MISSING_REF);
		const inside = await adapter.isRepository();
		const outside = await withTempDir('git-adapter-examples-', (directory) =>
			new GitAdapter(directory).isRepository()
		);
		expect(missing).toBeUndefined();
		expect(inside).toBe(true);
		expect(outside).toBe(false);
		recordExampleCases(meta('GitAdapter.attempt', 'probes-the-repository-without-failing'), [
			{ name: 'missing ref probe returns undefined (null in JSON)', input: MISSING_REF, output: missing ?? null },
			{ name: 'repository root reports a work tree', input: 'isRepository', output: inside },
			{ name: 'plain directory reports no work tree', input: 'isRepository', output: outside }
		]);
	});
}, 20_000);

test('Rejects a failing command with the Git error', async () => {
	await withTempRepo(async (repository) => {
		const adapter = new GitAdapter(repository.root);
		const error: unknown = await adapter.run(MISSING_REF).catch((caught: unknown) => caught);
		expect(error).toBeInstanceOf(GitCommandError);
		const message = (error as Error).message;
		expect(message).toContain('git rev-parse --verify refs/heads/missing failed:');
		recordExampleCases(meta('GitAdapter.run', 'rejects-a-failing-command-with-the-git-error'), [
			{ name: 'missing ref rejects with the command and stderr', input: MISSING_REF, error: message }
		]);
	});
}, 20_000);

test('Returns the nonzero exit in exec results', async () => {
	await withTempRepo(async (repository) => {
		const adapter = new GitAdapter(repository.root);
		const result: GitResult = await adapter.exec(MISSING_REF);
		expect(result.code).not.toBe(0);
		expect(result.stdout.length).toBe(0);
		expect(typeof result.stderr).toBe('string');
		recordExampleCases(meta('GitAdapter.exec', 'returns-the-nonzero-exit-in-exec-results'), [
			{
				name: 'missing ref exits nonzero with empty stdout',
				input: MISSING_REF,
				output: { code: result.code, stdoutBytes: result.stdout.length }
			}
		]);
	});
}, 20_000);

test('Pipes stdin and applies environment overrides', async () => {
	await withTempRepo(async (repository) => {
		const adapter = new GitAdapter(repository.root);
		const stdinOptions: GitRunOptions = { input: STDIN_TEXT, timeoutMs: 10000 };
		const hash = await adapter.run(['hash-object', '--stdin'], stdinOptions);
		const envOptions: GitRunOptions = { env: AUTHOR_ENV, timeoutMs: 30000, maxBuffer: 1048576 };
		const ident = await adapter.run(['var', 'GIT_AUTHOR_IDENT'], envOptions);
		expect(hash).toMatch(SHA_PATTERN);
		expect(ident).toBe('Example Author <author@example.invalid> 1700000000 +0000');
		recordExampleCases(meta('GitAdapter.run', 'pipes-stdin-and-applies-environment-overrides'), [
			{ name: 'stdin text hashes to a blob object id', input: STDIN_TEXT, output: hash },
			{ name: 'author environment overrides reach git var', input: AUTHOR_ENV, output: ident }
		]);
	});
}, 20_000);

test('Chooses the verb and deadline for Git arguments', async () => {
	const local = gitDeadline(['status', '--short']);
	const long = gitDeadline(['push', 'origin', 'main']);
	const unknown = gitDeadline(['--version']);
	const verb = gitVerb(['-C', '/workspace/repos/adapter', 'status', '--short']);
	const afterValue = gitVerb(['--config-env', 'core.editor=GIT_EDITOR', 'log', '-1']);
	const noVerb = gitVerb(['--version']);
	expect(verb).toBe('status');
	expect(afterValue).toBe('log');
	expect(noVerb).toBeUndefined();
	expect(local).toBeLessThan(long);
	expect(unknown).toBe(long);
	recordExampleCases(meta('gitDeadline', 'chooses-the-verb-and-deadline-for-git-arguments'), [
		{ name: 'status after -C uses the local deadline', input: ['-C', '/workspace/repos/adapter', 'status', '--short'], output: verb },
		{ name: 'log after a valued global option is found', input: ['--config-env', 'core.editor=GIT_EDITOR', 'log', '-1'], output: afterValue ?? null },
		{ name: 'push uses the long deadline', input: ['push', 'origin', 'main'], output: long },
		{ name: 'no verb uses the long deadline', input: ['--version'], output: unknown }
	]);
});
