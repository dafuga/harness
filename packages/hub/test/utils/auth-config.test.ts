import { expect, test } from 'vitest';
import { authConfig } from '../../src/lib/server/auth/authConfig';

const google = {
	HARNESS_GOOGLE_CLIENT_ID: 'synthetic-client.apps.googleusercontent.com',
	HARNESS_SESSION_SECRET: 'synthetic-session-secret-0123456789abcdef',
	HARNESS_PUBLIC_ORIGIN: 'https://hub.test',
	HARNESS_ENVIRONMENT: 'staging'
};
const github = {
	HARNESS_GITHUB_APP_ID: '4242',
	HARNESS_GITHUB_PRIVATE_KEY: 'synthetic-pem',
	HARNESS_GITHUB_CLIENT_ID: 'Iv1.synthetic',
	HARNESS_GITHUB_CLIENT_SECRET: 'synthetic-client-secret'
};

test('authConfig is null until every Google sign-in value is usable', () => {
	expect(authConfig({})).toBeNull();
	expect(authConfig({ ...google, HARNESS_GOOGLE_CLIENT_ID: '' })).toBeNull();
	expect(authConfig({ ...google, HARNESS_SESSION_SECRET: 'x'.repeat(31) })).toBeNull();
	expect(authConfig({ ...google, HARNESS_ENVIRONMENT: 'test' })).toBeNull();
	expect(authConfig(google)).toMatchObject({
		clientId: google.HARNESS_GOOGLE_CLIENT_ID,
		origin: 'https://hub.test',
		environment: 'staging',
		github: null
	});
});

test('authConfig takes an exact origin and plain http only for local loopback', () => {
	const origin = (value: string, environment = 'staging') =>
		authConfig({ ...google, HARNESS_PUBLIC_ORIGIN: value, HARNESS_ENVIRONMENT: environment });
	expect(origin('https://hub.test/')?.origin).toBe('https://hub.test');
	expect(origin('https://hub.test/path')).toBeNull();
	expect(origin('https://user:pass@hub.test')).toBeNull();
	expect(origin('https://hub.test?x=1')).toBeNull();
	expect(origin('http://hub.test', 'local')).toBeNull();
	expect(origin('http://127.0.0.1:5798', 'staging')).toBeNull();
	expect(origin('http://127.0.0.1:5798', 'local')?.origin).toBe('http://127.0.0.1:5798');
	expect(origin('not a url')).toBeNull();
});

test('authConfig enables GitHub only with all four app values', () => {
	expect(authConfig({ ...google, ...github, HARNESS_GITHUB_CLIENT_SECRET: '' })?.github).toBeNull();
	expect(authConfig({ ...google, ...github, HARNESS_GITHUB_APP_ID: 'abc' })?.github).toBeNull();
	expect(authConfig({ ...google, ...github })?.github).toMatchObject({
		appId: '4242',
		clientId: 'Iv1.synthetic',
		collaboration: null
	});
});

test('authConfig names the collaboration repository only from two positive integers', () => {
	const ids = (repository: string, installation: string) =>
		authConfig({
			...google,
			...github,
			HARNESS_COLLABORATION_REPOSITORY_ID: repository,
			HARNESS_COLLABORATION_INSTALLATION_ID: installation
		})?.github?.collaboration;
	expect(ids('900', '77')).toEqual({ repositoryId: 900, installationId: 77 });
	expect(ids('900', '')).toBeNull();
	expect(ids('-1', '77')).toBeNull();
	expect(ids('9.5', '77')).toBeNull();
});
