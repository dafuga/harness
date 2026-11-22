import { mkdtemp, rm, writeFile } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join, resolve } from 'node:path';
import { test } from 'vitest';
import { expect } from '../../../../test/verificationExpect';
import { recordExampleCases } from '../../../../test/support/recordExampleCases';
import {
	deploymentConfig,
	deploymentPath
} from '../../src/utils/projects-sessions/deploymentConfig';

const deploymentSettings = {
	adapter: 'cloudflare',
	sourceBranch: 'main',
	config: 'wrangler.jsonc',
	environments: {}
};
const wranglerConfiguration = {
	name: 'shop-worker',
	account_id: '0123456789abcdef0123456789abcdef',
	env: {
		dev: {
			name: 'shop-worker-dev',
			account_id: '0123456789abcdef0123456789abcdef',
			health_url: 'https://api.example.com/health'
		},
		stage: {
			name: 'shop-worker-stage',
			account_id: 'invalid-account-id',
			health_url: 'not a URL'
		}
	}
};

test('Resolves paths inside the project and rejects escapes', () => {
	const root = '/workspace/project';
	const path = 'packages/desktop/src/utils/deploymentConfig.ts';
	const resolved = deploymentPath(root, path);
	let rootError: { name: string; message: string } | null = null;
	let escapeError: { name: string; message: string } | null = null;
	try {
		deploymentPath(root, '.');
	} catch (error) {
		rootError = {
			name: error instanceof Error ? error.name : typeof error,
			message: error instanceof Error ? error.message : String(error)
		};
	}
	try {
		deploymentPath(root, '../outside/wrangler.jsonc');
	} catch (error) {
		escapeError = {
			name: error instanceof Error ? error.name : typeof error,
			message: error instanceof Error ? error.message : String(error)
		};
	}
	expect(resolved).toBe(resolve(root, path));
	expect(rootError).toEqual({
		name: 'DeploymentConfigError',
		message: 'Deployment paths must stay inside the project.'
	});
	expect(escapeError).toEqual({
		name: 'DeploymentConfigError',
		message: 'Deployment paths must stay inside the project.'
	});
	if (rootError === null || escapeError === null) throw new Error('Expected rejected paths.');
	recordExampleCases(
		{
			unitId: 'desktop.function.deployment-config',
			symbol: 'deploymentPath',
			state: 'resolves-paths-inside-the-project-and-rejects-escapes',
			evidence: 'examples-cases',
			file: 'resolves-paths-inside-the-project-and-rejects-escapes.json'
		},
		[
			{ name: 'resolve a project-relative source path', input: { root, path }, output: resolved },
			{ name: 'reject the project root itself', input: { root, path: '.' }, error: rootError },
			{
				name: 'reject a path above the project',
				input: { root, path: '../outside/wrangler.jsonc' },
				error: escapeError
			}
		]
	);
});

test('Loads detected targets and fingerprints both config files', async () => {
	const root = await mkdtemp(join(tmpdir(), 'harness-deployment-config-'));
	try {
		await writeFile(join(root, 'harness.deploy.json'), JSON.stringify(deploymentSettings));
		await writeFile(join(root, 'wrangler.jsonc'), JSON.stringify(wranglerConfiguration));
		const result = await deploymentConfig(root);
		const output = {
			sourceBranch: result.sourceBranch,
			targetEnvironments: Object.keys(result.targets).sort(),
			dev: result.targets.dev ?? null,
			fingerprint: result.fingerprint ?? null
		};
		expect(output).toEqual({
			sourceBranch: 'main',
			targetEnvironments: ['dev'],
			dev: {
				wranglerEnvironment: 'dev',
				branch: '',
				tokenEnv: 'HARNESS_SHOP_WORKER_DEV_CLOUDFLARE_API_TOKEN',
				healthUrl: 'https://api.example.com/health',
				accountId: '0123456789abcdef0123456789abcdef',
				name: 'shop-worker-dev',
				environment: 'dev',
				kind: 'workers',
				config: 'wrangler.jsonc',
				output: ''
			},
			fingerprint: 'dc1e4af35329d8128eb61a0a8d37eaf248fb3caeb5c2267254e3cb551b43b6fc'
		});
		recordExampleCases(
			{
				unitId: 'desktop.function.deployment-config',
				symbol: 'deploymentConfig',
				state: 'loads-detected-targets-and-fingerprints-both-config-files',
				evidence: 'examples-cases',
				file: 'loads-detected-targets-and-fingerprints-both-config-files.json'
			},
			[
				{
					name: 'detect a valid dev target and omit an invalid stage candidate',
					input: { root, deploymentSettings, wranglerConfiguration },
					output
				}
			]
		);
	} finally {
		await rm(root, { recursive: true, force: true });
	}
});
