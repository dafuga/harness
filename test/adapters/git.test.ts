import { mkdtemp, rm } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { afterEach, expect, test, vi } from 'vitest';
import { BoundedCommandAdapter } from '../../src/adapters/execution-runtimes/BoundedCommandAdapter';
import { GitAdapter } from '../../src/adapters/git-source-history/GitAdapter';
import { gitDeadline } from '../../src/adapters/git-source-history/git-adapter/gitDeadline';
import { measureWorkload } from '../support/measureWorkload';

// Initial method matrix: run/bytes/attempt/exec/isRepository and bounded errors.
const roots: string[] = [];
afterEach(async () => {
	vi.restoreAllMocks();
	vi.unstubAllEnvs();
	await Promise.all(roots.splice(0).map((root) => rm(root, { recursive: true, force: true })));
});
async function fixture() {
	const root = await mkdtemp(join(tmpdir(), 'harness-git-adapter-'));
	roots.push(root);
	return new GitAdapter(root);
}
test('run returns trimmed text and bytes preserves binary data', async () => {
	const git = await fixture();
	vi.stubEnv('SSH_AUTH_SOCK', '/fixture/ssh-agent.sock');
	vi.stubEnv('HARNESS_UNRELATED_SECRET', 'synthetic');
	const run = vi.spyOn(BoundedCommandAdapter.prototype, 'run');
	expect(
		await measureWorkload('adapter.git-source-history.GitAdapter', 'local-git-version', () =>
			git.run(['--version'])
		)
	).toMatch(/^git version /);
	expect(
		run.mock.calls.some((call) => call[2]?.env?.SSH_AUTH_SOCK === '/fixture/ssh-agent.sock')
	).toBe(true);
	expect(
		run.mock.calls.some((call) => Object.hasOwn(call[2]?.env ?? {}, 'HARNESS_UNRELATED_SECRET'))
	).toBe(false);
	expect(await git.bytes(['hash-object', '--stdin'], { input: 'hello' })).toEqual(
		Buffer.from('b6fc4c620b67d95f953a5c1c1230aaab5db5a1b0\n')
	);
});
test('git children receive scoped authentication and transport configuration', async () => {
	const git = await fixture();
	vi.stubEnv('GIT_CONFIG_NOSYSTEM', '1');
	vi.stubEnv('GIT_ASKPASS', '/fixture/askpass');
	vi.stubEnv('SSH_ASKPASS', '/fixture/ssh-askpass');
	vi.stubEnv('SSL_CERT_FILE', '/fixture/ca.pem');
	vi.stubEnv('HTTP_PROXY', 'http://fixture.invalid:8000');
	vi.stubEnv('GH_TOKEN', 'synthetic-github-token');
	vi.stubEnv('HARNESS_GIT_UNRELATED_SECRET', 'synthetic');
	const result = await git.exec(['-c', 'alias.showenv=!env', 'showenv']);
	const output = result.stdout.toString();
	expect(result.code).toBe(0);
	for (const value of [
		'GIT_CONFIG_NOSYSTEM=1',
		'GIT_ASKPASS=/fixture/askpass',
		'SSH_ASKPASS=/fixture/ssh-askpass',
		'SSL_CERT_FILE=/fixture/ca.pem',
		'HTTP_PROXY=http://fixture.invalid:8000',
		'GH_TOKEN=synthetic-github-token'
	])
		expect(output).toContain(value);
	expect(output).not.toContain('HARNESS_GIT_UNRELATED_SECRET');
});
test('attempt and exec retain unsuccessful exit information', async () => {
	const git = await fixture();
	expect(await git.attempt(['rev-parse', 'HEAD'])).toBeUndefined();
	expect(await git.exec(['rev-parse', 'HEAD'])).toMatchObject({ code: 128 });
	await expect(git.run(['rev-parse', 'HEAD'])).rejects.toThrow(/failed:/);
});
test('isRepository distinguishes repositories from plain directories', async () => {
	const git = await fixture();
	expect(await git.isRepository()).toBe(false);
	await git.run(['init', '-q']);
	expect(await git.isRepository()).toBe(true);
});
test('git deadlines distinguish local work from network and long-running verbs', () => {
	expect(gitDeadline(['status'])).toBe(30 * 60 * 1000);
	expect(gitDeadline(['fetch', 'origin'])).toBe(6 * 60 * 60 * 1000);
	expect(gitDeadline(['-C', '/tmp/repo', 'worktree', 'add', '/tmp/tree'])).toBe(6 * 60 * 60 * 1000);
});
test('exec stops commands that exceed the deadline or combined output limit', async () => {
	const git = await fixture();
	await git.run(['init', '-q']);
	await expect(git.exec(['-c', 'alias.wait=!sleep 2', 'wait'], { timeoutMs: 50 })).rejects.toThrow(
		/timed out/
	);
	await expect(git.exec(['--version'], { maxBuffer: 1 })).rejects.toThrow(/output limit/);
});
