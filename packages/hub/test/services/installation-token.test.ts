import { generateKeyPairSync } from 'node:crypto';
import { expect, test } from 'vitest';
import type { InstallationTokenInput } from '../../src/models/HubAuth.types';
import {
	COLLABORATION_REPOSITORY,
	FOREIGN_INSTALLATION,
	FOREIGN_REPOSITORY,
	OWNER_INSTALLATION,
	SOURCE_REPOSITORY
} from '../support/githubFakeState';
import { failure, githubFixture } from '../support/githubFixture';

const read = (
	repositoryId: number,
	installationId = OWNER_INSTALLATION
): InstallationTokenInput => ({
	installationId,
	repositoryIds: [repositoryId],
	permissions: { contents: 'read' }
});
const write = (
	repositoryId: number,
	installationId = OWNER_INSTALLATION
): InstallationTokenInput => ({
	...read(repositoryId, installationId),
	permissions: { contents: 'write' }
});

test('a source token is read-only and scoped to the named repository', async () => {
	const { tokens, github } = await githubFixture();
	const token = await tokens.token(read(SOURCE_REPOSITORY));
	expect(github.state.mints).toEqual([
		{
			installationId: OWNER_INSTALLATION,
			repositoryIds: [SOURCE_REPOSITORY],
			permissions: { contents: 'read', metadata: 'read' },
			token
		}
	]);
	const [call] = github.state.calls;
	expect(call.url).toBe('https://api.github.com/app/installations/71/access_tokens');
	expect(call.authorization).toMatch(/^Bearer [\w-]+\.[\w-]+\.[\w-]+$/);
});

test('a write token exists only for the configured collaboration repository', async () => {
	const { tokens, github } = await githubFixture();
	expect(await tokens.token(write(COLLABORATION_REPOSITORY))).toMatch(/^ghs_/);
	expect(github.state.mints[0].permissions.contents).toBe('write');
	const denied = 'Hub auth token-scope-denied';
	expect(await failure(tokens.token(write(SOURCE_REPOSITORY)))).toBe(denied);
	const elsewhere = write(COLLABORATION_REPOSITORY, FOREIGN_INSTALLATION);
	expect(await failure(tokens.token(elsewhere))).toBe(denied);
	const both = { ...write(COLLABORATION_REPOSITORY), repositoryIds: [9002, 9001] };
	expect(await failure(tokens.token(both))).toBe(denied);
	expect(github.state.mints).toHaveLength(1);
	const unset = await githubFixture({ collaboration: null });
	expect(await failure(unset.tokens.token(write(COLLABORATION_REPOSITORY)))).toBe(denied);
});

test('malformed or widened requests are refused before GitHub is called', async () => {
	const { tokens, github } = await githubFixture();
	const base = read(SOURCE_REPOSITORY);
	const bad = [
		{ ...base, repositoryIds: [] },
		{ ...base, repositoryIds: [SOURCE_REPOSITORY, SOURCE_REPOSITORY] },
		{ ...base, repositoryIds: [1.5] },
		{ ...base, repositoryIds: Array.from({ length: 11 }, (_, index) => index + 1) },
		{ ...base, installationId: 0 },
		{ ...base, permissions: { contents: 'admin' } },
		{ ...base, permissions: { contents: 'read', administration: 'write' } }
	];
	for (const input of bad) {
		const attempt = tokens.token(input as InstallationTokenInput);
		expect(await failure(attempt)).toBe('Hub auth token-scope-denied');
	}
	expect(github.state.calls).toHaveLength(0);
});

test('GitHub decides whether the installation really holds the repository', async () => {
	const { tokens } = await githubFixture();
	const denied = 'Hub auth repository-denied';
	expect(await failure(tokens.token(read(FOREIGN_REPOSITORY)))).toBe(denied);
	expect(await failure(tokens.token(read(SOURCE_REPOSITORY, 999)))).toBe(denied);
	const other = generateKeyPairSync('rsa', { modulusLength: 2048 });
	const privateKey = other.privateKey.export({ type: 'pkcs1', format: 'pem' }).toString();
	const impostor = await githubFixture({ privateKey });
	expect(await failure(impostor.tokens.token(read(SOURCE_REPOSITORY)))).toBe(denied);
});

test('a token wider than what was asked for is discarded', async () => {
	const { tokens, github, cache } = await githubFixture();
	github.state.widen = true;
	const attempt = tokens.token(read(SOURCE_REPOSITORY));
	expect(await failure(attempt)).toBe('Hub auth token-scope-denied');
	expect(cache.size).toBe(0);
});

test('tokens are reused until shortly before they expire, per scope', async () => {
	const { tokens, github, advance } = await githubFixture();
	const first = await tokens.token(read(COLLABORATION_REPOSITORY));
	expect(await tokens.token(read(COLLABORATION_REPOSITORY))).toBe(first);
	expect(await tokens.token(write(COLLABORATION_REPOSITORY))).not.toBe(first);
	expect(github.state.mints).toHaveLength(2);
	advance(3_600_000 - 300_000);
	expect(await tokens.token(read(COLLABORATION_REPOSITORY))).not.toBe(first);
	expect(github.state.mints).toHaveLength(3);
});

test('a provider outage is reported without provider detail', async () => {
	const { tokens, github } = await githubFixture();
	github.state.outage = true;
	const message = await failure(tokens.token(read(SOURCE_REPOSITORY)));
	expect(message).toBe('Hub auth github-unavailable');
});

test('resolve asks GitHub for the repository behind an id with a metadata-only probe', async () => {
	const { tokens, github, cache } = await githubFixture();
	expect(await tokens.resolve(OWNER_INSTALLATION, SOURCE_REPOSITORY)).toEqual({
		id: SOURCE_REPOSITORY,
		owner: 'synthetic-org',
		name: 'source',
		private: false,
		installationId: OWNER_INSTALLATION
	});
	expect(github.state.mints[0].permissions).toEqual({ metadata: 'read' });
	expect(await tokens.resolve(OWNER_INSTALLATION, FOREIGN_REPOSITORY)).toBeNull();
	expect(cache.size).toBe(0);
});
