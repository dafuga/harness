import { test } from 'vitest';
import { expect } from '../verificationExpect';
import { recordExampleCases } from '../support/recordExampleCases';
import { withTempDir, withTempRepo } from '../support/temporary';
import { commitIdentity } from '../../src/utils/git-source-history/commitIdentity';
import { GitAdapter } from '../../src/adapters/git-source-history/GitAdapter';
import { readFileSync, writeFileSync } from 'node:fs';
import { join } from 'node:path';

const FALLBACK = {
	GIT_AUTHOR_NAME: 'Harness',
	GIT_AUTHOR_EMAIL: 'harness@localhost',
	GIT_COMMITTER_NAME: 'Harness',
	GIT_COMMITTER_EMAIL: 'harness@localhost'
};
const REPO_NAME = 'Repo Owner';
const REPO_EMAIL = 'repo-owner@example.invalid';
const ISOLATED_KEYS = ['GIT_CONFIG_GLOBAL', 'GIT_CONFIG_NOSYSTEM'] as const;

function meta(state: string) {
	return {
		unitId: 'function.commit-identity',
		symbol: 'commitIdentity',
		state,
		evidence: 'examples-cases',
		file: `${state}.json`
	};
}

/**
 * Points Git's global and system config reads at an empty disposable file for one case, then
 * restores the caller's environment. The user's own Git configuration is never read or written.
 */
async function withIsolatedConfig<T>(use: () => Promise<T>): Promise<T> {
	return withTempDir('commit-identity-config-', async (directory) => {
		const emptyConfig = join(directory, 'empty.gitconfig');
		writeFileSync(emptyConfig, '');
		const saved = ISOLATED_KEYS.map((key) => [key, process.env[key]] as const);
		process.env.GIT_CONFIG_GLOBAL = emptyConfig;
		process.env.GIT_CONFIG_NOSYSTEM = '1';
		try {
			return await use();
		} finally {
			for (const [key, value] of saved) {
				if (value === undefined) delete process.env[key];
				else process.env[key] = value;
			}
		}
	});
}

test('Resolves repository-configured identity into all four keys', async () => {
	await withTempRepo(async (repository) => {
		await withIsolatedConfig(async () => {
			repository.git('config', 'user.name', REPO_NAME);
			repository.git('config', 'user.email', REPO_EMAIL);
			const identity = await commitIdentity(new GitAdapter(repository.root));
			expect(identity).toEqual({
				GIT_AUTHOR_NAME: REPO_NAME,
				GIT_AUTHOR_EMAIL: REPO_EMAIL,
				GIT_COMMITTER_NAME: REPO_NAME,
				GIT_COMMITTER_EMAIL: REPO_EMAIL
			});
			recordExampleCases(meta('repository-configured-identity-fills-all-four-keys'), [
				{
					name: 'repository user.name and user.email',
					input: 'config user.name/user.email',
					output: identity
				}
			]);
		});
	});
}, 20_000);

test('Falls back to Harness when no identity is configured', async () => {
	await withTempRepo(async (repository) => {
		await withIsolatedConfig(async () => {
			repository.git('config', '--local', '--unset', 'user.name');
			repository.git('config', '--local', '--unset', 'user.email');
			const identity = await commitIdentity(new GitAdapter(repository.root));
			expect(identity).toEqual(FALLBACK);
			recordExampleCases(meta('missing-identity-falls-back-to-harness'), [
				{ name: 'no user.name or user.email configured', input: 'no config', output: identity }
			]);
		});
	});
}, 20_000);

test('Falls back per field for empty or partial identity values', async () => {
	await withTempRepo(async (repository) => {
		await withIsolatedConfig(async () => {
			const adapter = new GitAdapter(repository.root);
			repository.git('config', 'user.name', '');
			repository.git('config', 'user.email', REPO_EMAIL);
			const emptyName = await commitIdentity(adapter);
			repository.git('config', 'user.name', REPO_NAME);
			repository.git('config', 'user.email', '');
			const emptyEmail = await commitIdentity(adapter);
			repository.git('config', '--local', '--unset', 'user.email');
			const missingEmail = await commitIdentity(adapter);

			expect(emptyName).toEqual({
				...FALLBACK,
				GIT_AUTHOR_EMAIL: REPO_EMAIL,
				GIT_COMMITTER_EMAIL: REPO_EMAIL
			});
			expect(emptyEmail).toEqual({
				...FALLBACK,
				GIT_AUTHOR_NAME: REPO_NAME,
				GIT_COMMITTER_NAME: REPO_NAME
			});
			expect(missingEmail).toEqual(emptyEmail);
			recordExampleCases(meta('empty-or-partial-identity-falls-back-per-field'), [
				{
					name: 'empty user.name keeps configured email',
					input: 'user.name="", user.email set',
					output: emptyName
				},
				{
					name: 'empty user.email keeps configured name',
					input: 'user.name set, user.email=""',
					output: emptyEmail
				},
				{
					name: 'unset user.email keeps configured name',
					input: 'user.name set, user.email unset',
					output: missingEmail
				}
			]);
		});
	});
}, 20_000);

test('Resolving identity leaves Git configuration unchanged', async () => {
	await withTempRepo(async (repository) => {
		await withIsolatedConfig(async () => {
			const configPath = join(repository.root, '.git', 'config');
			repository.git('config', '--local', '--unset', 'user.email');
			const before = readFileSync(configPath, 'utf8');
			const listBefore = repository.git('config', '--local', '--list');
			const identity = await commitIdentity(new GitAdapter(repository.root));
			const after = readFileSync(configPath, 'utf8');
			const listAfter = repository.git('config', '--local', '--list');
			expect(after).toBe(before);
			expect(listAfter).toBe(listBefore);
			expect(identity.GIT_AUTHOR_EMAIL).toBe(FALLBACK.GIT_AUTHOR_EMAIL);
			recordExampleCases(meta('identity-resolution-leaves-git-config-unchanged'), [
				{
					name: 'repository config file bytes after resolution',
					input: 'read .git/config',
					output: after === before
				}
			]);
		});
	});
}, 20_000);
