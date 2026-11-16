import { afterEach, test, vi } from 'vitest';
import { chmod, mkdir, mkdtemp, rm, writeFile } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { expect } from '../../../../test/verificationExpect';
import { recordExampleCases } from '../../../../test/support/recordExampleCases';
import {
	deploymentBlockers,
	deploymentCurrent,
	deploymentHealth,
	deploymentProof
} from '../../src/utils/projects-sessions/deploymentProof';
import type {
	CloudflareTarget,
	DeploymentConfig,
	DeploymentPlan,
	DeploymentPlugin
} from '../../src/models/development-tooling/Deployment.types';

const temporaryRoots: string[] = [];
const commit = 'a1b2c3d4e5f60718293a4b5c6d7e8f901234abcd';

afterEach(async () => {
	vi.unstubAllEnvs();
	vi.unstubAllGlobals();
	await Promise.all(
		temporaryRoots.splice(0).map((root) => rm(root, { recursive: true, force: true }))
	);
});

function deploymentTarget(): CloudflareTarget {
	return {
		environment: 'dev',
		kind: 'workers',
		config: 'wrangler.jsonc',
		name: 'desktop-demo-dev',
		accountId: '0123456789abcdef0123456789abcdef',
		tokenEnv: 'HARNESS_DESKTOP_DEV_CLOUDFLARE_API_TOKEN',
		wranglerEnvironment: 'dev',
		branch: '',
		output: '',
		healthUrl: 'https://desktop-demo.example.com/health'
	};
}

async function temporaryProject(gitScript: string): Promise<string> {
	const root = await mkdtemp(join(tmpdir(), 'deployment-proof-'));
	temporaryRoots.push(root);
	const bin = join(root, 'bin');
	await mkdir(bin, { recursive: true });
	await mkdir(join(root, '.git'));
	const git = join(bin, 'git');
	await writeFile(git, gitScript);
	await chmod(git, 0o755);
	vi.stubEnv('PATH', bin);
	return root;
}

test('Hashes the JSON-serialized deployment configuration', () => {
	const config: DeploymentConfig = {
		sourceBranch: 'main',
		targets: { dev: deploymentTarget() }
	};
	const fingerprint = deploymentProof(config);
	const reorderedFingerprint = deploymentProof({
		targets: config.targets,
		sourceBranch: config.sourceBranch
	});

	expect(fingerprint).toBe('032e63cd4500b5755274248b9bd7428833e767c69c974e6a23eeccf5aa8b8ec1');
	expect(reorderedFingerprint).not.toBe(fingerprint);
	recordExampleCases(
		{
			unitId: 'desktop.function.deployment-proof',
			symbol: 'deploymentProof',
			state: 'hashes-the-json-serialized-deployment-configuration',
			evidence: 'examples-cases',
			file: 'hashes-the-json-serialized-deployment-configuration.json'
		},
		[
			{ name: 'hash the complete development target mapping', input: config, output: fingerprint },
			{
				name: 'preserve top-level property order in the digest',
				input: { targets: config.targets, sourceBranch: config.sourceBranch },
				output: reorderedFingerprint
			}
		]
	);
});

test('Reports production blockers when promotion targets are missing', async () => {
	const root = await temporaryProject(
		`#!/bin/sh\ncase "$3:$4" in\n  rev-parse:--git-common-dir) printf '.git\\n' ;;\n  *) exit 2 ;;\nesac\n`
	);
	const config: DeploymentConfig = { sourceBranch: 'main', targets: { dev: deploymentTarget() } };
	const query = { commit, environment: 'prod' as const };
	const result = await deploymentBlockers(root, query, config);
	vi.unstubAllEnvs();
	const blockers = [
		'Configure both preprod and production deployment targets.',
		'Deploy a verified source commit to preprod first.'
	];

	expect(result).toEqual({
		blockers,
		branch: 'main',
		promotion: { preprod: null, production: null, commitsBehind: null }
	});
	recordExampleCases(
		{
			unitId: 'desktop.function.deployment-proof',
			symbol: 'deploymentBlockers',
			state: 'reports-production-blockers-when-promotion-targets-are-missi',
			evidence: 'examples-cases',
			file: 'reports-production-blockers-when-promotion-targets-are-missi.json'
		},
		[
			{
				name: 'check production with only a development target configured',
				input: { root, query, config },
				output: result
			}
		]
	);
});

test('Checks deployment health from the HTTP response', async () => {
	const target = deploymentTarget();
	let status = 200;
	let redirect: RequestRedirect | undefined;
	vi.stubGlobal(
		'fetch',
		vi.fn(async (_url: string | URL, options?: RequestInit) => {
			redirect = options?.redirect;
			return new Response(null, { status });
		})
	);
	const healthy = await deploymentHealth(target);
	status = 503;
	const unavailable = await deploymentHealth(target);
	vi.unstubAllGlobals();

	expect(healthy).toBe(true);
	expect(unavailable).toBe(false);
	expect(redirect).toBe('error');
	recordExampleCases(
		{
			unitId: 'desktop.function.deployment-proof',
			symbol: 'deploymentHealth',
			state: 'checks-deployment-health-from-the-http-response',
			evidence: 'examples-cases',
			file: 'checks-deployment-health-from-the-http-response.json'
		},
		[
			{ name: 'accept an ok health response', input: target, output: healthy },
			{ name: 'reject a non-ok health response', input: target, output: unavailable }
		]
	);
});

test('Returns the current discovered deployment configuration', async () => {
	const root = await temporaryProject(
		`#!/bin/sh\ncase "$3:$4" in\n  symbolic-ref:--quiet) printf 'main\\n' ;;\n  rev-parse:HEAD) printf '${commit}\\n' ;;\n  rev-parse:--git-common-dir) printf '.git\\n' ;;\n  status:--porcelain) ;;\n  *) exit 2 ;;\nesac\n`
	);
	const discoveredConfig: DeploymentConfig = {
		sourceBranch: '',
		targets: { dev: deploymentTarget() }
	};
	const plan: DeploymentPlan = {
		id: '7f8c1e2a-4b6d-4c89-a012-3456789abcde',
		environment: 'dev',
		commit,
		branch: 'main',
		adapter: 'cloudflare',
		target:
			'workers · desktop-demo-dev · dev · account 0123456789abcdef0123456789abcdef · https://desktop-demo.example.com/health',
		steps: [
			'Prepare source',
			'Run checks',
			'Build source',
			'Deploy to Cloudflare',
			'Verify health'
		],
		blockers: [],
		expiresAt: '2026-12-01T04:40:30.000Z'
	};
	const fingerprint = deploymentProof({ ...discoveredConfig, sourceBranch: plan.branch });
	const plugin: DeploymentPlugin = {
		id: 'cloudflare',
		discover: async () => discoveredConfig,
		deploy: async () => ({ deploymentId: 'fixture-deployment', url: 'https://example.invalid' })
	};
	const input = JSON.parse(JSON.stringify({ root, plan, fingerprint, discoveredConfig }));
	const current = await deploymentCurrent(root, plan, { plugin, fingerprint });
	vi.unstubAllEnvs();
	const output = { sourceBranch: current.sourceBranch, targetName: current.targets.dev?.name };

	expect(output).toEqual({ sourceBranch: 'main', targetName: 'desktop-demo-dev' });
	recordExampleCases(
		{
			unitId: 'desktop.function.deployment-proof',
			symbol: 'deploymentCurrent',
			state: 'returns-the-current-discovered-deployment-configuration',
			evidence: 'examples-cases',
			file: 'returns-the-current-discovered-deployment-configuration.json'
		},
		[{ name: 'recheck the reviewed development plan', input, output }]
	);
});
