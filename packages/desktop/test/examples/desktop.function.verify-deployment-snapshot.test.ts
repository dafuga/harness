import { execFileSync } from 'node:child_process';
import { mkdtempSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { test } from 'vitest';
import { expect } from '../../../../test/verificationExpect';
import { recordExampleCases } from '../../../../test/support/recordExampleCases';
import type { DeploymentPlugin } from '../../src/models/development-tooling/Deployment.types';
import type { ReviewedDeployment } from '../../src/services/development-tooling/DeploymentService';
import { deploymentProof } from '../../src/utils/projects-sessions/deploymentProof';
import {
	captureDeploymentTarget,
	verifyDeploymentSnapshot
} from '../../src/utils/verification-evidence/verifyDeploymentSnapshot';
import { DeploymentSnapshotVerificationError } from '../../src/utils/verification-evidence/verifyDeploymentSnapshot.types';

const COMMIT = '0123456789abcdef0123456789abcdef01234567';
const PLAN_STEPS = ['Prepare source', 'Run checks', 'Build source', 'Deploy to Cloudflare'];

type Environment = ReviewedDeployment['plan']['environment'];

async function withRoot(run: (root: string) => Promise<void>) {
	const root = mkdtempSync(join(tmpdir(), 'deploy-snapshot-'));
	try {
		// deploymentState reads Git metadata from the root, so the fixture must be an empty repository.
		execFileSync('git', ['init', '-q', root]);
		await run(root);
	} finally {
		rmSync(root, { recursive: true, force: true });
	}
}

async function captureError(run: () => Promise<unknown>): Promise<Error> {
	try {
		await run();
	} catch (error) {
		if (error instanceof Error) return error;
		throw error;
	}
	throw new Error('Expected a rejection.');
}

function configFor(environments: Environment[]) {
	const targets = Object.fromEntries(
		environments.map((environment) => [
			environment,
			{
				environment,
				kind: 'workers',
				config: 'wrangler.jsonc',
				name: 'desktop-dev',
				accountId: '0123456789abcdef0123456789abcdef',
				tokenEnv: 'HARNESS_DESKTOP_DEV_CLOUDFLARE_API_TOKEN',
				wranglerEnvironment: environment,
				branch: '',
				output: '',
				healthUrl: 'https://desktop-dev.workers.dev'
			}
		])
	);
	return { sourceBranch: 'main', targets };
}

function fingerprintOf(config: unknown): string {
	return deploymentProof(config as Parameters<typeof deploymentProof>[0]);
}

function pluginFor(config: unknown): DeploymentPlugin {
	return {
		id: 'cloudflare',
		discover: () => Promise.resolve(config),
		deploy: () => Promise.resolve({ deploymentId: 'deployment-example', url: 'https://desktop-dev.workers.dev' })
	} as unknown as DeploymentPlugin;
}

function reviewedFor(root: string, environment: Environment, fingerprint: string): ReviewedDeployment {
	return {
		sourceEnvironment: null,
		plan: {
			id: '550e8400-e29b-41d4-a716-446655440000',
			environment,
			commit: COMMIT,
			branch: 'main',
			adapter: 'cloudflare',
			target: `workers · desktop-dev · ${environment}`,
			steps: PLAN_STEPS,
			blockers: [],
			expiresAt: '2026-11-15T12:05:00.000Z'
		},
		fingerprint,
		root,
		projectId: null,
		predecessor: null
	} as ReviewedDeployment;
}

test('Rejects a reviewed configuration that changed', async () => {
	await withRoot(async (root) => {
		const plugin = pluginFor(configFor(['dev']));
		const reviewed = reviewedFor(root, 'dev', 'stale-fingerprint');
		const captured = await captureError(() => captureDeploymentTarget(reviewed, plugin));
		const verified = await captureError(() =>
			verifyDeploymentSnapshot(root, reviewed, { plugin, destination: null })
		);

		expect(captured).toBeInstanceOf(DeploymentSnapshotVerificationError);
		expect(captured.message).toBe('Deployment configuration changed; review again.');
		expect(verified).toBeInstanceOf(DeploymentSnapshotVerificationError);
		expect(verified.message).toBe('Deployment configuration changed; review again.');

		recordExampleCases(
			{
				unitId: 'desktop.function.verify-deployment-snapshot',
				symbol: 'captureDeploymentTarget',
				state: 'rejects-a-reviewed-configuration-that-changed',
				evidence: 'examples-cases',
				file: 'rejects-a-reviewed-configuration-that-changed.json'
			},
			[
				{
					name: 'capture with a stale configuration fingerprint',
					input: { environment: 'dev', fingerprint: 'stale-fingerprint' },
					error: { name: captured.name, message: captured.message }
				},
				{
					name: 'verify with a stale configuration fingerprint',
					input: { root, environment: 'dev', fingerprint: 'stale-fingerprint' },
					error: { name: verified.name, message: verified.message }
				}
			]
		);
	});
});

test('Rejects a later environment without its predecessor proof', async () => {
	await withRoot(async (root) => {
		const config = configFor(['dev', 'stage']);
		const plugin = pluginFor(config);
		const reviewed = reviewedFor(root, 'stage', fingerprintOf(config));
		const error = await captureError(() => captureDeploymentTarget(reviewed, plugin));

		expect(error).toBeInstanceOf(DeploymentSnapshotVerificationError);
		expect(error.message).toBe(
			'A verified dev deployment of this exact source and configuration is required.'
		);

		recordExampleCases(
			{
				unitId: 'desktop.function.verify-deployment-snapshot',
				symbol: 'captureDeploymentTarget',
				state: 'rejects-a-later-environment-without-its-predecessor-proof',
				evidence: 'examples-cases',
				file: 'rejects-a-later-environment-without-its-predecessor-proof.json'
			},
			[
				{
					name: 'capture stage with no dev predecessor receipt',
					input: { environment: 'stage', predecessor: null, configuredEnvironments: ['dev', 'stage'] },
					error: { name: error.name, message: error.message }
				}
			]
		);
	});
});

test('Captures the dev target when no receipt exists', async () => {
	await withRoot(async (root) => {
		const config = configFor(['dev']);
		const plugin = pluginFor(config);
		const reviewed = reviewedFor(root, 'dev', fingerprintOf(config));
		const captured = await captureDeploymentTarget(reviewed, plugin);
		const verified = await verifyDeploymentSnapshot(root, reviewed, { plugin, destination: null });

		expect(captured.destination).toBeNull();
		expect(captured.target).toMatchObject({ environment: 'dev', name: 'desktop-dev' });
		expect(verified).toBeUndefined();

		recordExampleCases(
			{
				unitId: 'desktop.function.verify-deployment-snapshot',
				symbol: 'captureDeploymentTarget',
				state: 'captures-the-dev-target-when-no-receipt-exists',
				evidence: 'examples-cases',
				file: 'captures-the-dev-target-when-no-receipt-exists.json'
			},
			[
				{
					name: 'capture dev target with no destination receipt',
					input: { environment: 'dev', destination: null },
					output: {
						target: { environment: captured.target.environment, name: captured.target.name },
						destination: null
					}
				},
				{
					name: 'verify unchanged dev snapshot with no destination receipt',
					input: { root, environment: 'dev', destination: null },
					output: { resolved: verified === undefined }
				}
			]
		);
	});
});
