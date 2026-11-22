import { test } from 'vitest';
import { expect } from '../../../../test/verificationExpect';
import { recordExampleCases } from '../../../../test/support/recordExampleCases';
import { authConfig } from '../../src/lib/verification-evidence/server/auth/authConfig';
import type {
	CollaborationScope,
	GithubAppConfig,
	AuthConfig
} from '../../src/utils/verification-evidence/authConfig';

const collaboration = {
	repositoryId: 582931046,
	installationId: 47126385
} satisfies CollaborationScope;

const githubApp = {
	appId: '512345',
	privateKey: '-----BEGIN RSA PRIVATE KEY-----\nMIIEpAIBAAKCAQEA7kq2bV0xR9sT3mLd\n-----END RSA PRIVATE KEY-----',
	clientId: 'Iv1.8a61f9b3a7aba766',
	clientSecret: '9f3a7c1e5b2d8a6f0c4e9b1d7a3f5c8e2b6d0a4f',
	collaboration
} satisfies GithubAppConfig;

const stagingGithub = {
	appId: '698104',
	privateKey: '-----BEGIN RSA PRIVATE KEY-----\nMIIEowIBAAKCAQEAu3Lq8ZfK2hVx0nRc\n-----END RSA PRIVATE KEY-----',
	clientId: 'Iv1.3c9e0d7b2f4a6815',
	clientSecret: 'e51d7a0c3b9f48266d2e8a1c5f7b0d3e9a4c6f21',
	collaboration: null
} satisfies GithubAppConfig;

const productionEnv = {
	HARNESS_GOOGLE_CLIENT_ID: '123456789012-7d2k1q9x0m3n8b5c.apps.googleusercontent.com',
	HARNESS_SESSION_SECRET: '3f9a1c7e5b2d8f0a6c4e9b1d7a3f5c8e2b6d0a4f9c1e7b3d5a8f2c6e0b4d9a17',
	HARNESS_PUBLIC_ORIGIN: 'https://hub.example.com',
	HARNESS_ENVIRONMENT: 'production',
	HARNESS_GITHUB_APP_ID: '512345',
	HARNESS_GITHUB_PRIVATE_KEY: githubApp.privateKey,
	HARNESS_GITHUB_CLIENT_ID: githubApp.clientId,
	HARNESS_GITHUB_CLIENT_SECRET: githubApp.clientSecret,
	HARNESS_COLLABORATION_REPOSITORY_ID: '582931046',
	HARNESS_COLLABORATION_INSTALLATION_ID: '47126385'
};

const stagingEnv = {
	HARNESS_GOOGLE_CLIENT_ID: '987654321098-q8w2e4r6t1y3u5i0.apps.googleusercontent.com',
	HARNESS_SESSION_SECRET: 'c0d5e8a1f4b7932e6a0c5d8f1b4e7a2c9d3f6b0e8a5c1d4f7b2e9a6c3d0f8b15',
	HARNESS_PUBLIC_ORIGIN: 'https://staging.hub.example.com',
	HARNESS_ENVIRONMENT: 'staging',
	HARNESS_GITHUB_APP_ID: stagingGithub.appId,
	HARNESS_GITHUB_PRIVATE_KEY: stagingGithub.privateKey,
	HARNESS_GITHUB_CLIENT_ID: stagingGithub.clientId,
	HARNESS_GITHUB_CLIENT_SECRET: stagingGithub.clientSecret
};

const localEnv = {
	HARNESS_GOOGLE_CLIENT_ID: '123456789012-7d2k1q9x0m3n8b5c.apps.googleusercontent.com',
	HARNESS_SESSION_SECRET: '0c6e1a9d4b7f2835e0a3c8d6f1b4e7a92d5c0f8b3e6a1d4c7f9b2e5a8d0c3f61',
	HARNESS_PUBLIC_ORIGIN: 'http://localhost:3000',
	HARNESS_ENVIRONMENT: 'local'
};

const productionConfig = {
	clientId: productionEnv.HARNESS_GOOGLE_CLIENT_ID,
	secret: productionEnv.HARNESS_SESSION_SECRET,
	origin: 'https://hub.example.com',
	environment: 'production',
	github: githubApp
} satisfies AuthConfig;

const stagingConfig = {
	clientId: stagingEnv.HARNESS_GOOGLE_CLIENT_ID,
	secret: stagingEnv.HARNESS_SESSION_SECRET,
	origin: 'https://staging.hub.example.com',
	environment: 'staging',
	github: stagingGithub
} satisfies AuthConfig;

const localConfig = {
	clientId: localEnv.HARNESS_GOOGLE_CLIENT_ID,
	secret: localEnv.HARNESS_SESSION_SECRET,
	origin: 'http://localhost:3000',
	environment: 'local',
	github: null
} satisfies AuthConfig;

const invalidCore = [
	{ name: 'session secret shorter than 32 characters', change: { HARNESS_SESSION_SECRET: 'a'.repeat(31) } },
	{ name: 'environment outside local, staging and production', change: { HARNESS_ENVIRONMENT: 'preview' } },
	{ name: 'plain HTTP origin on a non-local environment', change: { HARNESS_PUBLIC_ORIGIN: 'http://hub.example.com' } },
	{ name: 'origin with a path beyond the slash', change: { HARNESS_PUBLIC_ORIGIN: 'https://hub.example.com/admin' } }
];

const invalidGithub = [
	{ name: 'GitHub App ID with a leading zero', change: { HARNESS_GITHUB_APP_ID: '0512345' } },
	{ name: 'collaboration repository ID of zero', change: { HARNESS_COLLABORATION_REPOSITORY_ID: '0' } },
	{ name: 'GitHub client ID containing a space', change: { HARNESS_GITHUB_CLIENT_ID: 'Iv1 8a61' } }
];

test('Builds sign-in settings with GitHub and collaboration', () => {
	const production = authConfig(productionEnv);
	const staging = authConfig(stagingEnv);
	const local = authConfig(localEnv);
	expect([production, staging, local]).toEqual([productionConfig, stagingConfig, localConfig]);
	recordExampleCases(
		{
			unitId: 'hub.function.auth-config',
			symbol: 'authConfig',
			state: 'builds-sign-in-settings-with-github-and-collaboration',
			evidence: 'examples-cases',
			file: 'builds-sign-in-settings-with-github-and-collaboration.json'
		},
		[
			{ name: 'production with GitHub and collaboration', input: productionEnv, output: production },
			{ name: 'staging with GitHub but no collaboration', input: stagingEnv, output: staging },
			{ name: 'local HTTP localhost without GitHub', input: localEnv, output: local }
		]
	);
});

test('Disables sign-in for invalid core settings', () => {
	const results = invalidCore.map((item) => authConfig({ ...productionEnv, ...item.change }));
	expect(results).toEqual([null, null, null, null]);
	recordExampleCases(
		{
			unitId: 'hub.function.auth-config',
			symbol: 'authConfig',
			state: 'disables-sign-in-for-invalid-core-settings',
			evidence: 'examples-cases',
			file: 'disables-sign-in-for-invalid-core-settings.json'
		},
		invalidCore.map((item, index) => ({ name: item.name, input: item.change, output: results[index] }))
	);
});

test('Keeps sign-in but drops invalid GitHub settings', () => {
	const results = invalidGithub.map((item) => authConfig({ ...productionEnv, ...item.change }));
	expect(results).toEqual([
		{ ...productionConfig, github: null },
		{ ...productionConfig, github: { ...githubApp, collaboration: null } },
		{ ...productionConfig, github: null }
	]);
	recordExampleCases(
		{
			unitId: 'hub.function.auth-config',
			symbol: 'authConfig',
			state: 'keeps-sign-in-but-drops-invalid-github-settings',
			evidence: 'examples-cases',
			file: 'keeps-sign-in-but-drops-invalid-github-settings.json'
		},
		invalidGithub.map((item, index) => ({ name: item.name, input: item.change, output: results[index] }))
	);
});
