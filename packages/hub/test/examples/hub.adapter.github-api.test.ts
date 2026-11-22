import { test } from 'vitest';
import { expect } from '../../../../test/verificationExpect';
import { recordExampleCases } from '../../../../test/support/recordExampleCases';
import { GithubApiAdapter } from '../../src/lib/verification-evidence/server/auth/GithubApiAdapter';
import type { GithubApiOptions, InstallationScope } from '../../src/lib/verification-evidence/server/auth/GithubApiAdapter.types';

function adapterFor(body: unknown, status = 200): { adapter: GithubApiAdapter; calls: Array<{ url: string; init: RequestInit }> } {
	const calls: Array<{ url: string; init: RequestInit }> = [];
	const options: GithubApiOptions = {
		fetch: async (input, init = {}) => {
			calls.push({ url: String(input), init });
			return new Response(JSON.stringify(body), { status, headers: { 'Content-Type': 'application/json' } });
		}
	};
	return { adapter: new GithubApiAdapter(options), calls };
}

test('userToken exchanges an authorization code', async () => {
	const { adapter, calls } = adapterFor({ access_token: 'gho_Qx7Lm2Rt9Vb4Nc8Zp1Wk6Hs3Yj5Df0Ga', token_type: 'bearer', expires_in: 28800 });
	const form = { client_id: 'Iv1.5c2e8a9b0d7f4e13', client_secret: '0f9e8d7c6b5a4f3e2d1c0b9a8f7e6d5c4b3a2f1e', code: '3d8f1a9c2e7b5046' };
	const output = await adapter.userToken(form);
	expect(output).toEqual({ accessToken: 'gho_Qx7Lm2Rt9Vb4Nc8Zp1Wk6Hs3Yj5Df0Ga', expiresIn: 28800, refreshToken: null, refreshExpiresIn: null });
	expect(calls[0]?.init.redirect).toBe('manual');
	recordExampleCases({ unitId: 'hub.adapter.github-api', symbol: 'GithubApiAdapter.userToken', state: 'usertoken-exchanges-an-authorization-code', evidence: 'examples-cases', file: 'usertoken-exchanges-an-authorization-code.json' }, [{ name: 'valid code returns a normalized user token', input: { form, endpoint: calls[0]?.url, method: calls[0]?.init.method, body: calls[0]?.init.body }, output }]);
});

test('user reads the authenticated account', async () => {
	const { adapter, calls } = adapterFor({ id: 7315042, login: 'kestrel-dev' });
	const token = 'gho_Qx7Lm2Rt9Vb4Nc8Zp1Wk6Hs3Yj5Df0Ga';
	const output = await adapter.user(token);
	expect(output).toEqual({ id: 7315042, login: 'kestrel-dev' });
	recordExampleCases({ unitId: 'hub.adapter.github-api', symbol: 'GithubApiAdapter.user', state: 'user-reads-the-authenticated-account', evidence: 'examples-cases', file: 'user-reads-the-authenticated-account.json' }, [{ name: 'account lookup returns its id and login', input: { token, url: calls[0]?.url, authorization: (calls[0]?.init.headers as Record<string, string>).Authorization }, output }]);
});

test('installations keeps live entries for the requested app', async () => {
	const { adapter, calls } = adapterFor({ total_count: 2, installations: [{ id: 48213577, app_id: 512840, suspended_at: null }, { id: 61290114, app_id: 512840, suspended_at: null }, { id: 700, app_id: 99, suspended_at: null }] });
	const token = 'gho_Mw5Kp9Xz2Qt7Lv4Hb1Cn8Rj3Fd6Sy0Ua';
	const output = await adapter.installations(token, 512840);
	expect(output).toEqual({ ids: [48213577, 61290114], total: 2 });
	recordExampleCases({ unitId: 'hub.adapter.github-api', symbol: 'GithubApiAdapter.installations', state: 'installations-keeps-live-entries-for-the-requested-app', evidence: 'examples-cases', file: 'installations-keeps-live-entries-for-the-requested-app.json' }, [{ name: 'installations are filtered by app id', input: { token, appId: 512840, url: calls[0]?.url }, output }]);
});

test('installationRepositories returns one repository page', async () => {
	const body = { total_count: 1, repositories: [{ id: 1029384756, owner: { login: 'acme-labs' }, name: 'harness-hub', private: true, permissions: { admin: false } }] };
	const { adapter, calls } = adapterFor(body);
	const input = { token: 'gho_Lr8Nd3Vq6Ws1Tk4Hc9Zf2Mb7Xj0Py5Ga', installationId: 48213577, page: 3 };
	const output = await adapter.installationRepositories(input.token, input.installationId, input.page);
	expect(output).toEqual({ repositories: [{ id: 1029384756, owner: 'acme-labs', name: 'harness-hub', private: true, admin: false }], total: 1 });
	recordExampleCases({ unitId: 'hub.adapter.github-api', symbol: 'GithubApiAdapter.installationRepositories', state: 'installationrepositories-returns-one-repository-page', evidence: 'examples-cases', file: 'installationrepositories-returns-one-repository-page.json' }, [{ name: 'page query returns normalized repository details', input: { ...input, url: calls[0]?.url }, output }]);
});

test('repository reads a valid target and rejects an invalid one', async () => {
	const { adapter, calls } = adapterFor({ id: 1029384756, owner: { login: 'acme-labs' }, name: 'harness-hub', private: true, permissions: { admin: true } });
	const token = 'gho_Ps9Vn4Kd2Mt7Qb1Lz6Rx3Hj8Yc5Wf0Ea';
	const target = { owner: 'acme-labs', name: 'harness-hub' };
	const output = await adapter.repository(token, target);
	const invalid = await adapter.repository(token, { owner: 'bad/name', name: 'harness-hub' });
	expect(output).toEqual({ id: 1029384756, owner: 'acme-labs', name: 'harness-hub', private: true, admin: true });
	expect(invalid).toBeNull();
	recordExampleCases({ unitId: 'hub.adapter.github-api', symbol: 'GithubApiAdapter.repository', state: 'repository-reads-a-valid-target-and-rejects-an-invalid-one', evidence: 'examples-cases', file: 'repository-reads-a-valid-target-and-rejects-an-invalid-one.json' }, [{ name: 'valid target returns repository and admin access', input: { token, target, url: calls[0]?.url }, output }, { name: 'invalid owner is rejected without a request', input: { token, target: { owner: 'bad/name', name: 'harness-hub' } }, output: invalid }]);
});

test('installationToken requests a scoped installation grant', async () => {
	const body = { token: 'ghs_Lm4Qr8Tv2Xb6Zn1Wk9Hs5Yj3Df7Ga0Cp', expires_at: '2026-11-15T12:00:00Z', permissions: { contents: 'read', metadata: 'read' }, repositories: [{ id: 1029384756, owner: { login: 'acme-labs' }, name: 'harness-hub', private: true, permissions: { admin: false } }] };
	const { adapter, calls } = adapterFor(body);
	const jwt = 'eyJhbGciOiJSUzI1NiIsInR5cCI6IkpXVCJ9.eyJpYXQiOjE3OTQ3NDY3MDAsImV4cCI6MTc5NDc0NzAwMCwiaXNzIjoiNTEyODQwIn0.c2lnbmF0dXJlLWV4YW1wbGUtb25seS1ub3QtdmFsaWQ';
	const scope: InstallationScope = { repository_ids: [1029384756, 1029384801], permissions: { contents: 'read', metadata: 'read' } };
	const output = await adapter.installationToken(jwt, 52907341, scope);
	expect(output).toEqual({ token: body.token, expiresAt: Date.parse(body.expires_at), permissions: body.permissions, repositories: [{ id: 1029384756, owner: 'acme-labs', name: 'harness-hub', private: true, admin: false }] });
	recordExampleCases({ unitId: 'hub.adapter.github-api', symbol: 'GithubApiAdapter.installationToken', state: 'installationtoken-requests-a-scoped-installation-grant', evidence: 'examples-cases', file: 'installationtoken-requests-a-scoped-installation-grant.json' }, [{ name: 'scoped grant is returned with parsed expiry', input: { jwt, installationId: 52907341, scope, url: calls[0]?.url, body: calls[0]?.init.body }, output }]);
});
