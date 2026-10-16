import { expect, test } from 'vitest';
import { GithubResponseValidator } from '../../src/validators/GithubResponseValidator';

const github = new GithubResponseValidator();
const repo = {
	id: 9001,
	name: 'source',
	owner: { login: 'synthetic-org' },
	private: true,
	permissions: { admin: true }
};

test('GithubResponseValidator reads a user token only when it is a bearer token', () => {
	const token = { access_token: 'ghu_a', token_type: 'bearer', expires_in: 28800 };
	expect(github.userToken(token)).toMatchObject({ accessToken: 'ghu_a', expiresIn: 28800 });
	expect(github.userToken({ ...token, token_type: 'mac' })).toBeNull();
	expect(github.userToken({ ...token, error: 'bad_verification_code' })).toBeNull();
	expect(github.userToken({ ...token, access_token: 'has space' })).toBeNull();
	expect(github.userToken(null)).toBeNull();
});

test('GithubResponseValidator takes admin only from an explicit true', () => {
	expect(github.repository(repo)).toEqual({
		id: 9001,
		owner: 'synthetic-org',
		name: 'source',
		private: true,
		admin: true
	});
	expect(github.repository({ ...repo, permissions: { admin: 'true' } })?.admin).toBe(false);
	expect(github.repository({ ...repo, permissions: undefined })?.admin).toBe(false);
	expect(github.repository({ ...repo, owner: { login: 'bad/owner' } })).toBeNull();
	expect(github.repository({ ...repo, name: '..' })).toBeNull();
	expect(github.repository({ ...repo, id: '9001' })).toBeNull();
	expect(github.repository({ ...repo, private: 'no' })).toBeNull();
});

test('GithubResponseValidator keeps only live installations of this app', () => {
	const installations = [
		{ id: 71, app_id: 4242, suspended_at: null },
		{ id: 72, app_id: 4242, suspended_at: '2026-01-01T00:00:00Z' },
		{ id: 73, app_id: 7, suspended_at: null },
		{ id: 'x', app_id: 4242 }
	];
	const parsed = github.installations({ total_count: 4, installations }, 4242);
	expect(parsed).toEqual({ ids: [71], total: 4 });
	expect(github.installations({ installations: 'none' }, 4242)).toBeNull();
});

test('GithubResponseValidator needs a token, an expiry and repositories on a grant', () => {
	const grant = {
		token: 'ghs_a',
		expires_at: '2026-10-12T10:00:00Z',
		permissions: { contents: 'read', metadata: 'read' },
		repositories: [repo]
	};
	expect(github.installationGrant(grant)).toMatchObject({
		token: 'ghs_a',
		expiresAt: Date.UTC(2026, 9, 12, 10, 0, 0),
		permissions: { contents: 'read', metadata: 'read' }
	});
	expect(github.installationGrant({ ...grant, repositories: undefined })).toBeNull();
	expect(github.installationGrant({ ...grant, expires_at: 'soon' })).toBeNull();
	expect(github.installationGrant({ ...grant, permissions: { contents: 1 } })).toBeNull();
	expect(github.installationGrant({ ...grant, repositories: [{ id: 1 }] })).toBeNull();
});
