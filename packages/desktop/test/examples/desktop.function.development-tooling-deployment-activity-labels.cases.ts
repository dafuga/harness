import { test } from 'vitest';
import { expect } from '../../../../test/verificationExpect';
import { recordExampleCases } from '../../../../test/support/recordExampleCases';
import { standingFailures } from '../../src/components/development-tooling/deploymentActivityLabels';
import type { DeploymentActivity } from '../../src/models/development-tooling/Deployment.types';

const unitId = 'desktop.function.development-tooling-deployment-activity-labels';
const steps: DeploymentActivity['steps'] = [
	{ id: 'preparing', title: 'Prepare source' },
	{ id: 'checking', title: 'Run checks' },
	{ id: 'building', title: 'Build source' },
	{ id: 'uploading', title: 'Deploy to Cloudflare' },
	{ id: 'verifying', title: 'Verify health' }
];

export function deployment(
	phase: DeploymentActivity['phase'],
	options: {
		projectId?: DeploymentActivity['projectId'];
		environment?: DeploymentActivity['environment'];
		step?: DeploymentActivity['step'];
		itemSteps?: DeploymentActivity['steps'];
	} = {}
): DeploymentActivity {
	const {
		projectId = 'storefront-local',
		environment = 'prod',
		step = null,
		itemSteps = steps
	} = options;
	return {
		phase,
		detail: `Deployment ${phase}`,
		sourceEnvironment: null,
		id: 'deployment-example',
		projectId,
		projectName: 'storefront',
		environment,
		commit: '9d4e2b7f1a6c3e8d5b0f9a27c4e83d61f2a7b95e',
		branch: 'main',
		steps: itemSteps,
		step,
		error: null,
		receipt: null,
		createdAt: '2026-11-15T09:30:12.084Z',
		startedAt: null,
		updatedAt: '2026-11-15T09:30:12.084Z',
		finishedAt: null
	};
}

export function record(
	symbol: string,
	state: string,
	cases: Array<{ name: string; input: unknown; output: unknown }>
) {
	recordExampleCases(
		{ unitId, symbol, state, evidence: 'examples-cases', file: `${state}.json` },
		cases
	);
}

test('Counts failures that still stand per destination', () => {
	const newestFirst = [
		deployment('queued', { projectId: 'storefront-local', environment: 'dev' }),
		deployment('failed', { projectId: 'storefront-local', environment: 'dev', step: 'uploading' }),
		deployment('failed', { projectId: 'storefront-local', environment: 'prod', step: 'uploading' }),
		deployment('complete', {
			projectId: 'storefront-local',
			environment: 'prod',
			step: 'verifying'
		})
	];
	const nullProjectId = [
		deployment('queued', { projectId: null, environment: 'stage' }),
		deployment('failed', { projectId: 'null', environment: 'stage', step: 'uploading' })
	];
	const count = standingFailures(newestFirst);
	const nullCollisionCount = standingFailures(nullProjectId);

	expect(count).toBe(1);
	expect(nullCollisionCount).toBe(0);
	record('standingFailures', 'counts-failures-that-still-stand-per-destination', [
		{
			name: 'count only the newest failure for each project and environment',
			input: newestFirst.map(({ phase, projectId, environment }) => ({
				phase,
				projectId,
				environment
			})),
			output: count
		},
		{
			name: 'compare a null project id as the text null',
			input: nullProjectId.map(({ phase, projectId, environment }) => ({
				phase,
				projectId,
				environment
			})),
			output: nullCollisionCount
		}
	]);
});
