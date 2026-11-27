import { afterEach, test } from 'vitest';
import { execFileSync } from 'node:child_process';
import { mkdtempSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { expect } from '../../../../test/verificationExpect';
import { recordExampleCases } from '../../../../test/support/recordExampleCases';
import {
	deploymentState,
	saveDeployment,
	deploymentStatus
} from '../../src/utils/projects-sessions/deploymentState';
import type {
	DeploymentConfig,
	DeploymentPlugin,
	DeploymentReceipt
} from '../../src/models/development-tooling/Deployment.types';
import type { Target, Status } from './desktop.function.deployment-state.test.types';

const created: string[] = [];
const target = {} as Target;

afterEach(() => {
	for (const dir of created.splice(0)) rmSync(dir, { recursive: true, force: true });
});

function makeRepo(): string {
	const dir = mkdtempSync(join(tmpdir(), 'deployment-state-'));
	created.push(dir);
	execFileSync('git', ['init', '-q', dir]);
	return dir;
}

function makeFolder(): string {
	const dir = mkdtempSync(join(tmpdir(), 'deployment-state-outside-'));
	created.push(dir);
	return dir;
}

const devReceipt: DeploymentReceipt = {
	environment: 'dev',
	commit: '3f9c1e7a0b2d4e6f8a1c3b5d7e9f0a2b4c6d8e1f',
	branch: 'feature/deploy-receipts',
	updatedAt: '2026-11-14T09:30:00.000Z',
	adapter: 'cloudflare',
	deploymentId: '8f1c2a7e-3b4d-4e9a-a1f6-5c2d9b7e0f31',
	url: 'https://example-dev.workers.dev'
};

const prodReceipt: DeploymentReceipt = {
	environment: 'prod',
	commit: 'a41b7c09e2f35d8b6c1a0e9f7d4b2c8e5a3f6d10',
	branch: 'main',
	updatedAt: '2026-11-12T16:05:42.318Z',
	adapter: 'cloudflare',
	deploymentId: 'c27e90fa-5d1b-4b6e-8a3c-9f0e1d2b3a48',
	url: 'https://example-prod.workers.dev'
};

const replacementDev: DeploymentReceipt = {
	...devReceipt,
	commit: 'b7d2e4f6a8c0e1f3b5d7a9c1e3f5b7d9a1c3e5f7'
};

function plugin(config: DeploymentConfig | null): DeploymentPlugin {
	return {
		id: 'cloudflare',
		discover: () =>
			config
				? Promise.resolve(config)
				: Promise.reject(new Error('Invalid Cloudflare configuration.')),
		deploy: () => Promise.resolve({ deploymentId: 'unused', url: 'https://unused.workers.dev' })
	};
}

function summary(statuses: Status) {
	return statuses.map((item) => ({
		environment: item.environment,
		receipt: item.receipt?.commit ?? null,
		available: item.available,
		reason: item.reason
	}));
}

test('Reads back receipts written by saveDeployment', async () => {
	const root = makeRepo();
	await saveDeployment(root, devReceipt);
	await saveDeployment(root, prodReceipt);
	await saveDeployment(root, replacementDev);
	const stored = await deploymentState(root);

	expect(stored).toEqual([prodReceipt, replacementDev]);

	recordExampleCases(
		{
			unitId: 'desktop.function.deployment-state',
			symbol: 'deploymentState',
			state: 'reads-back-receipts-written-by-savedeployment',
			evidence: 'examples-cases',
			file: 'reads-back-receipts-written-by-savedeployment.json'
		},
		[
			{
				name: 'save dev, save prod, then replace dev',
				input: ['dev', 'prod', 'dev (new commit)'],
				output: stored.map((item) => ({ environment: item.environment, commit: item.commit }))
			}
		]
	);
});

test('Reads an empty list when no receipts file exists', async () => {
	const root = makeRepo();
	const stored = await deploymentState(root);

	expect(stored).toEqual([]);

	recordExampleCases(
		{
			unitId: 'desktop.function.deployment-state',
			symbol: 'deploymentState',
			state: 'reads-an-empty-list-when-no-receipts-file-exists',
			evidence: 'examples-cases',
			file: 'reads-an-empty-list-when-no-receipts-file-exists.json'
		},
		[{ name: 'fresh repository with no receipts', input: 'example-repo', output: stored }]
	);
});

test('Rejects a root outside any Git repository', async () => {
	const folder = makeFolder();
	let thrown: unknown;
	try {
		await deploymentState(folder);
	} catch (error) {
		thrown = error;
	}

	expect(thrown).toBeInstanceOf(Error);
	if (!(thrown instanceof Error)) throw new Error('Expected a git error.');

	recordExampleCases(
		{
			unitId: 'desktop.function.deployment-state',
			symbol: 'deploymentState',
			state: 'rejects-a-root-outside-any-git-repository',
			evidence: 'examples-cases',
			file: 'rejects-a-root-outside-any-git-repository.json'
		},
		[
			{
				name: 'folder outside any repository',
				input: 'example-folder',
				error: { name: thrown.name }
			}
		]
	);
});

test('Reports each environment with its receipt and target availability', async () => {
	const root = makeRepo();
	await saveDeployment(root, devReceipt);
	await saveDeployment(root, prodReceipt);
	const config = { sourceBranch: 'main', targets: { dev: target, stage: target } };
	const statuses = await deploymentStatus(root, plugin(config));
	const failed = await deploymentStatus(root, plugin(null));

	expect(summary(statuses)).toEqual([
		{
			environment: 'dev',
			receipt: devReceipt.commit,
			available: true,
			reason: 'Cloudflare target configured.'
		},
		{
			environment: 'stage',
			receipt: null,
			available: true,
			reason: 'Cloudflare target configured.'
		},
		{
			environment: 'preprod',
			receipt: null,
			available: false,
			reason: 'Deployment target not configured.'
		},
		{
			environment: 'prod',
			receipt: prodReceipt.commit,
			available: false,
			reason: 'Deployment target not configured.'
		}
	]);
	expect(summary(failed).every((item) => !item.available)).toBe(true);

	recordExampleCases(
		{
			unitId: 'desktop.function.deployment-state',
			symbol: 'deploymentStatus',
			state: 'reports-each-environment-with-its-receipt-and-target-availab',
			evidence: 'examples-cases',
			file: 'reports-each-environment-with-its-receipt-and-target-availab.json'
		},
		[
			{
				name: 'dev and stage targets configured',
				input: ['dev', 'stage'],
				output: summary(statuses)
			},
			{
				name: 'discover rejects the configuration',
				input: 'invalid',
				output: summary(failed)
			}
		]
	);
});
