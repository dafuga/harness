import { test } from 'vitest';
import { expect } from '../../../../test/verificationExpect';
import { recordExampleCases } from '../../../../test/support/recordExampleCases';
import { GithubResponseValidator } from '../../src/validators/development-tooling/GithubResponseValidator';
import type { Json, GithubUserToken, GithubUser, GithubRepository, InstallationList, RepositoryPage, InstallationGrant } from '../../src/validators/development-tooling/GithubResponseValidator.types';

const validator = new GithubResponseValidator();
const repo: Json = {
	id: 1296269, private: false, owner: { login: 'octocat' }, name: 'hello-world', permissions: { admin: true }
};
function record(symbol: string, state: string, cases: Array<{ name: string; input: unknown; output: unknown }>): void {
	recordExampleCases({ unitId: 'hub.validator.github-response', symbol, state, evidence: 'examples-cases', file: `${state}.json` }, cases);
}

test('Normalizes user token fields', () => {
	const input: Json = { access_token: 'ghu_example1234567890', token_type: 'bearer', expires_in: 28800, refresh_token: 'ghr_example1234567890', refresh_token_expires_in: 518400 };
	const output: GithubUserToken | null = validator.userToken(input);
	expect(output).toEqual({ accessToken: 'ghu_example1234567890', expiresIn: 28800, refreshToken: 'ghr_example1234567890', refreshExpiresIn: 518400 });
	const bad = validator.userToken({ ...input, token_type: 'basic' });
	expect(bad).toBeNull();
	record('userToken', 'normalizes-user-token-fields', [
		{ name: 'valid bearer token', input, output },
		{ name: 'rejects non-bearer token', input: { ...input, token_type: 'basic' }, output: bad }
	]);
});

test('Validates user identity', () => {
	const input: Json = { id: 583231, login: 'octocat' };
	const output: GithubUser | null = validator.user(input);
	expect(output).toEqual(input);
	const bad = validator.user({ id: 0, login: 'octocat' });
	expect(bad).toBeNull();
	record('user', 'validates-user-identity', [
		{ name: 'valid user', input, output },
		{ name: 'rejects nonpositive id', input: { id: 0, login: 'octocat' }, output: bad }
	]);
});

test('Validates repository access fields', () => {
	const output: GithubRepository | null = validator.repository(repo);
	expect(output).toEqual({ id: 1296269, owner: 'octocat', name: 'hello-world', private: false, admin: true });
	const noAdmin = validator.repository({ ...repo, permissions: { admin: 1 } });
	expect(noAdmin?.admin).toBe(false);
	const bad = validator.repository({ ...repo, name: '...' });
	expect(bad).toBeNull();
	record('repository', 'validates-repository-access-fields', [
		{ name: 'literal admin permission', input: repo, output },
		{ name: 'nonliteral admin permission', input: { ...repo, permissions: { admin: 1 } }, output: noAdmin },
		{ name: 'rejects dot-only name', input: { ...repo, name: '...' }, output: bad }
	]);
});

test('Selects active app installations', () => {
	const input: Json = { total_count: 1, installations: [{ app_id: 7654321, suspended_at: null, id: 12345678 }, { app_id: 7654321, suspended_at: '2026-01-01', id: 9 }] };
	const output: InstallationList | null = validator.installations(input, 7654321);
	expect(output).toEqual({ ids: [12345678], total: 1 });
	const fallback = validator.installations({ installations: [{ app_id: 7654321, id: 0 }] }, 7654321);
	expect(fallback).toEqual({ ids: [], total: 1 });
	record('installations', 'selects-active-app-installations', [
		{ name: 'filters matching active rows', input: { payload: input, appId: 7654321 }, output },
		{ name: 'falls back to original row count', input: { payload: { installations: [{ app_id: 7654321, id: 0 }] }, appId: 7654321 }, output: fallback }
	]);
});

test('Filters repository page entries', () => {
	const input: Json = { total_count: 1, repositories: [repo, { ...repo, id: -1 }] };
	const output: RepositoryPage | null = validator.repositories(input);
	expect(output).toEqual({ repositories: [{ id: 1296269, owner: 'octocat', name: 'hello-world', private: false, admin: true }], total: 1 });
	const bad = validator.repositories({ repositories: {} });
	expect(bad).toBeNull();
	record('repositories', 'filters-repository-page-entries', [
		{ name: 'drops invalid repositories', input, output },
		{ name: 'rejects missing array', input: { repositories: {} }, output: bad }
	]);
});

test('Parses installation grant', () => {
	const input: Json = { token: 'ghs_example1234567890', expires_at: '2026-12-01T12:00:00Z', permissions: { contents: 'read', metadata: 'read' }, repositories: [repo] };
	const output: InstallationGrant | null = validator.installationGrant(input);
	expect(output).toEqual({ token: 'ghs_example1234567890', expiresAt: Date.parse('2026-12-01T12:00:00Z'), permissions: { contents: 'read', metadata: 'read' }, repositories: [{ id: 1296269, owner: 'octocat', name: 'hello-world', private: false, admin: true }] });
	const bad = validator.installationGrant({ ...input, repositories: [{ ...repo, name: '...' }] });
	expect(bad).toBeNull();
	record('installationGrant', 'parses-installation-grant', [
		{ name: 'valid grant', input, output },
		{ name: 'rejects invalid repository', input: { ...input, repositories: [{ ...repo, name: '...' }] }, output: bad }
	]);
});
