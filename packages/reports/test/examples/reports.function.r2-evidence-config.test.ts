import { mkdtempSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { test } from 'vitest';
import { expect } from '../../../../test/verificationExpect';
import { recordExampleCases } from '../../../../test/support/recordExampleCases';
import { r2EvidenceConfig } from '../../src/utils/verification-evidence/r2EvidenceConfig';

type R2Settings = {
	accountId: string;
	bucket: string;
	accessKeyId: string;
	secretAccessKey: string;
	endpoint: string;
};
type Env = Record<string, string | undefined>;

const R2_KEYS: Record<keyof R2Settings, string> = {
	accountId: 'PROJECT_REPORTS_R2_ACCOUNT_ID',
	bucket: 'PROJECT_REPORTS_R2_BUCKET',
	accessKeyId: 'PROJECT_REPORTS_R2_ACCESS_KEY_ID',
	secretAccessKey: 'PROJECT_REPORTS_R2_SECRET_ACCESS_KEY',
	endpoint: 'PROJECT_REPORTS_R2_ENDPOINT'
};
const SOURCE_VARS = [
	'PROJECT_REPORTS_ASSET_STORAGE',
	'PROJECT_REPORTS_HOME',
	'PROJECT_REPORTS_CONFIG_FILE',
	...Object.values(R2_KEYS)
];
const EXAMPLE_PRIMARY: R2Settings = {
	accountId: '7c1e5a9d3b0f4e8a2d6c1b9f5e3a7d0c',
	bucket: 'report-evidence',
	accessKeyId: 'example-access-key-id',
	secretAccessKey: 'example-secret-access-key',
	endpoint: 'http://127.0.0.1:9000'
};
const EXAMPLE_PROD: R2Settings = {
	accountId: '3f9c1d7a5b2e4f60a8d9c7b1e2f3a4b5',
	bucket: 'report-evidence-prod',
	accessKeyId: 'example-prod-access-key-id',
	secretAccessKey: 'example-prod-secret-access-key',
	endpoint: 'http://127.0.0.1:9001'
};

function r2Env(settings: Partial<Record<keyof R2Settings, string | undefined>>): Env {
	const env: Env = {};
	for (const key of Object.keys(R2_KEYS) as (keyof R2Settings)[]) env[R2_KEYS[key]] = settings[key];
	return env;
}

function withEnv<T>(env: Env, run: () => T): T {
	for (const key of SOURCE_VARS) delete process.env[key];
	for (const [key, value] of Object.entries(env))
		if (value !== undefined) process.env[key] = value;
	try {
		return run();
	} finally {
		for (const key of SOURCE_VARS) delete process.env[key];
	}
}

function thrownBy(env: Env) {
	try {
		withEnv(env, () => r2EvidenceConfig());
		return undefined;
	} catch (error) {
		const { name, message } = error as Error;
		return { name, message };
	}
}

function withTempStore<T>(run: (dir: string) => T): T {
	const dir = mkdtempSync(join(tmpdir(), 'r2-evidence-config-'));
	try {
		return run(dir);
	} finally {
		rmSync(dir, { recursive: true, force: true });
	}
}

function record(state: string, cases: Parameters<typeof recordExampleCases>[1]) {
	recordExampleCases(
		{
			unitId: 'reports.function.r2-evidence-config',
			symbol: 'r2EvidenceConfig',
			state,
			evidence: 'examples-cases',
			file: `${state}.json`
		},
		cases
	);
}

test('Returns R2 settings from PROJECT_REPORTS_R2 variables', () => {
	const primary = withEnv(r2Env(EXAMPLE_PRIMARY), () => r2EvidenceConfig());
	const prod = withEnv(r2Env(EXAMPLE_PROD), () => r2EvidenceConfig());
	expect(primary).toEqual(EXAMPLE_PRIMARY);
	expect(prod).toEqual(EXAMPLE_PROD);
	record('returns-r2-settings-from-project-reports-r2-variables', [
		{ name: 'primary settings with local test endpoint', input: EXAMPLE_PRIMARY, output: primary },
		{ name: 'production-style settings with local endpoint', input: EXAMPLE_PROD, output: prod }
	]);
});

test('Returns no R2 settings for local storage in a temp store', () => {
	withTempStore((dir) => {
		const env = { PROJECT_REPORTS_ASSET_STORAGE: 'local', PROJECT_REPORTS_HOME: dir };
		const result = withEnv(env, () => r2EvidenceConfig());
		expect(result).toBeUndefined();
		record('returns-no-r2-settings-for-local-storage-in-a-temp-store', [
			{
				name: 'local storage under the OS temp directory',
				input: { PROJECT_REPORTS_ASSET_STORAGE: 'local', PROJECT_REPORTS_HOME: 'temporary store' },
				output: { settings: null }
			}
		]);
	});
});

test('Rejects local storage outside a temporary store', () => {
	const env = { PROJECT_REPORTS_ASSET_STORAGE: 'local', PROJECT_REPORTS_HOME: '/srv/report-evidence-example' };
	const error = thrownBy(env);
	expect(error).toEqual({
		name: 'EvidenceStorageConfigError',
		message:
			'Local-only storage is restricted to temporary test stores; real report media requires Cloudflare R2'
	});
	record('rejects-local-storage-outside-a-temporary-store', [
		{
			name: 'local storage pointed at a non-temporary home',
			input: { PROJECT_REPORTS_ASSET_STORAGE: 'local', PROJECT_REPORTS_HOME: '/srv/report-evidence-example' },
			error
		}
	]);
});

test('Rejects partially configured R2 settings', () => {
	const partial = { ...EXAMPLE_PRIMARY, secretAccessKey: null };
	const error = thrownBy(r2Env({ ...EXAMPLE_PRIMARY, secretAccessKey: undefined }));
	expect(error).toEqual({
		name: 'EvidenceStorageConfigError',
		message:
			'Cloudflare R2 evidence storage is partially configured; real reports require all four R2 settings'
	});
	record('rejects-partially-configured-r2-settings', [
		{ name: 'secret access key missing', input: partial, error }
	]);
});

test('Rejects an R2 endpoint that is not a local test server', () => {
	const remote = { ...EXAMPLE_PRIMARY, endpoint: 'https://r2.example.invalid' };
	const error = thrownBy(r2Env(remote));
	expect(error).toEqual({
		name: 'EvidenceStorageConfigError',
		message: 'R2 endpoint override must be a local test server'
	});
	record('rejects-an-r2-endpoint-that-is-not-a-local-test-server', [
		{ name: 'endpoint points at a remote host', input: remote, error }
	]);
});

test('Returns no R2 settings when all are empty in a temp store', () => {
	withTempStore((dir) => {
		const result = withEnv({ PROJECT_REPORTS_HOME: dir }, () => r2EvidenceConfig());
		expect(result).toBeUndefined();
		record('returns-no-r2-settings-when-all-are-empty-in-a-temp-store', [
			{
				name: 'all four R2 settings empty under the OS temp directory',
				input: { PROJECT_REPORTS_HOME: 'temporary store', r2Settings: 'all empty' },
				output: { settings: null }
			}
		]);
	});
});
