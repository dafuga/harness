import { mkdtempSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { test } from 'vitest';
import { expect } from '../../../../test/verificationExpect';
import { recordExampleCases } from '../../../../test/support/recordExampleCases';
import { CloudflareCredentialConfigurationError } from '../../src/adapters/development-tooling/CloudflareCredentialConfigurationError';
import { CloudflareDeployAdapter } from '../../src/adapters/development-tooling/CloudflareDeployAdapter';
import type { Options } from '../../src/adapters/development-tooling/CloudflareDeployAdapter.types';
import { CloudflareProductionBranchConflictError } from '../../src/adapters/development-tooling/CloudflareProductionBranchConflictError';
import { CloudflareProductionBranchUnknownError } from '../../src/adapters/development-tooling/CloudflareProductionBranchUnknownError';
import { CloudflareTargetAccessVerificationError } from '../../src/adapters/development-tooling/CloudflareTargetAccessVerificationError';
import type { Target, Log, Command } from './desktop.adapter.cloudflare-deploy.test.types';

const ACCOUNT_ID = '4f1c9a0d7b2e4c8a9d3f6e1b0a5c7d28';
const COMMIT = '3c1e8f2a9b7d4e60a5c2f1d8e9b3a7c4d0f2e6b1';
const TOKEN = 'example-token-value';
const PAGES_OUTPUT = 'Uploaded\nhttps://3f9a1c2b.acme-storefront.pages.dev';
const WORKERS_OUTPUT =
	'Uploaded acme-api-staging\nCurrent Version ID: 9d2f4b7e-3a1c-4e8b-b6d5-0f2a9c7e1d43';
const PAGES_LOOKUP = JSON.stringify({ success: true, result: { production_branch: 'main' } });
const UNKNOWN_LOOKUP = JSON.stringify({ success: false, result: {} });

const storefront: Target = {
	environment: 'prod',
	kind: 'pages',
	config: 'wrangler.jsonc',
	name: 'acme-storefront',
	accountId: ACCOUNT_ID,
	tokenEnv: 'HARNESS_EXAMPLE_STOREFRONT_TOKEN',
	wranglerEnvironment: '',
	branch: 'main',
	output: 'dist',
	healthUrl: 'https://storefront.acme.example/healthz'
};

const apiStaging: Target = {
	environment: 'stage',
	kind: 'workers',
	config: 'wrangler.jsonc',
	name: 'acme-api-staging',
	accountId: ACCOUNT_ID,
	tokenEnv: 'HARNESS_EXAMPLE_API_STAGE_TOKEN',
	wranglerEnvironment: 'staging',
	branch: '',
	output: '',
	healthUrl: 'https://api-staging.acme.example/health'
};

const emptyLog = (): Log => ({ commands: [], urls: [] });

function setToken(name: string, value: string | undefined) {
	if (value === undefined) delete process.env[name];
	else process.env[name] = value;
}

// The token value never reaches the recorded cases.
function redact(command: Command) {
	return {
		args: command.args,
		cwd: '<root>',
		env: { ...command.env, CLOUDFLARE_API_TOKEN: '<redacted>' }
	};
}

function fakeOptions(fake: { output: string; log: Log; status?: number; body?: string }): Options {
	return {
		execute: async (command) => {
			fake.log.commands.push(redact(command));
			return fake.output;
		},
		request: async (url) => {
			fake.log.urls.push(url);
			return new Response(fake.body ?? PAGES_LOOKUP, { status: fake.status ?? 200 });
		}
	};
}

async function failureOf(run: Promise<unknown>): Promise<unknown> {
	try {
		await run;
	} catch (error) {
		return error;
	}
	throw new Error('Expected the deploy to reject');
}

function describeError(error: unknown) {
	return error instanceof Error
		? { name: error.name, message: error.message }
		: { name: 'UnknownError', message: String(error) };
}

async function deployFailure(args: {
	target: Target;
	root: string;
	token?: boolean;
	status?: number;
	body?: string;
}) {
	const { target, root, token = true, status, body } = args;
	setToken(target.tokenEnv, token ? TOKEN : undefined);
	const options = fakeOptions({ output: '', log: emptyLog(), status, body });
	try {
		return await failureOf(
			new CloudflareDeployAdapter(options).deploy(target, { root, commit: COMMIT })
		);
	} finally {
		setToken(target.tokenEnv, undefined);
	}
}

test('Deploys Pages and Workers targets through the fake executor', async () => {
	const root = mkdtempSync(join(tmpdir(), 'cloudflare-deploy-'));
	const log = emptyLog();
	try {
		setToken(storefront.tokenEnv, TOKEN);
		setToken(apiStaging.tokenEnv, TOKEN);
		const pages = await new CloudflareDeployAdapter(
			fakeOptions({ output: PAGES_OUTPUT, log })
		).deploy(storefront, { root, commit: COMMIT });
		const workers = await new CloudflareDeployAdapter(
			fakeOptions({ output: WORKERS_OUTPUT, log })
		).deploy(apiStaging, { root, commit: COMMIT });
		expect(pages).toEqual({
			deploymentId: '3f9a1c2b',
			url: 'https://3f9a1c2b.acme-storefront.pages.dev'
		});
		expect(workers).toEqual({
			deploymentId: '9d2f4b7e-3a1c-4e8b-b6d5-0f2a9c7e1d43',
			url: apiStaging.healthUrl
		});
		expect(log.commands).toHaveLength(2);
		expect(log.urls).toHaveLength(2);
		recordExampleCases(
			{
				unitId: 'desktop.adapter.cloudflare-deploy',
				symbol: 'deploy',
				state: 'deploys-pages-and-workers-targets-through-the-fake-executor',
				evidence: 'examples-cases',
				file: 'deploys-pages-and-workers-targets-through-the-fake-executor.json'
			},
			[
				{
					name: 'Pages target deploys with the Pages wrangler arguments',
					input: { target: storefront.name, kind: 'pages', commit: COMMIT },
					output: { result: pages, command: log.commands[0] }
				},
				{
					name: 'Workers target deploys to the named Wrangler environment',
					input: { target: apiStaging.name, kind: 'workers', wranglerEnvironment: 'staging' },
					output: { result: workers, command: log.commands[1] }
				}
			]
		);
	} finally {
		setToken(storefront.tokenEnv, undefined);
		setToken(apiStaging.tokenEnv, undefined);
		rmSync(root, { recursive: true, force: true });
	}
});

test('Rejects deploys when credentials or target checks fail', async () => {
	const root = mkdtempSync(join(tmpdir(), 'cloudflare-deploy-'));
	try {
		const missing = await deployFailure({ root, target: storefront, token: false });
		const denied = await deployFailure({ root, target: storefront, status: 403 });
		const conflict = await deployFailure({
			root,
			target: { ...storefront, environment: 'stage' }
		});
		const unknown = await deployFailure({ root, target: storefront, body: UNKNOWN_LOOKUP });
		expect(missing).toBeInstanceOf(CloudflareCredentialConfigurationError);
		expect(denied).toBeInstanceOf(CloudflareTargetAccessVerificationError);
		expect(conflict).toBeInstanceOf(CloudflareProductionBranchConflictError);
		expect(unknown).toBeInstanceOf(CloudflareProductionBranchUnknownError);
		recordExampleCases(
			{
				unitId: 'desktop.adapter.cloudflare-deploy',
				symbol: 'deploy',
				state: 'rejects-deploys-when-credentials-or-target-checks-fail',
				evidence: 'examples-cases',
				file: 'rejects-deploys-when-credentials-or-target-checks-fail.json'
			},
			[
				{
					name: 'Missing credential rejects before any Cloudflare call',
					input: { target: storefront.name, tokenSet: false },
					error: describeError(missing)
				},
				{
					name: 'Failed target access check rejects the deploy',
					input: { target: storefront.name, tokenSet: true, accessStatus: 403 },
					error: describeError(denied)
				},
				{
					name: 'Stage Pages target on the production branch conflicts',
					input: { target: storefront.name, environment: 'stage', productionBranch: 'main' },
					error: describeError(conflict)
				},
				{
					name: 'Unknown production branch rejects the Pages target',
					input: { target: storefront.name, tokenSet: true, lookup: { success: false } },
					error: describeError(unknown)
				}
			]
		);
	} finally {
		setToken(storefront.tokenEnv, undefined);
		rmSync(root, { recursive: true, force: true });
	}
});
