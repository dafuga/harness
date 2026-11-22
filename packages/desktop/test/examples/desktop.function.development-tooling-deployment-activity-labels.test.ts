import { test } from 'vitest';
import { expect } from '../../../../test/verificationExpect';
import { recordExampleCases } from '../../../../test/support/recordExampleCases';
import {
	activityLight,
	activitySummary,
	itemLight,
	phaseLabel,
	standingFailures
} from '../../src/components/development-tooling/deploymentActivityLabels';
import type { DeploymentActivity } from '../../src/models/development-tooling/Deployment.types';

const unitId = 'desktop.function.development-tooling-deployment-activity-labels';
const steps: DeploymentActivity['steps'] = [
	{ id: 'preparing', title: 'Prepare source' },
	{ id: 'checking', title: 'Run checks' },
	{ id: 'building', title: 'Build source' },
	{ id: 'uploading', title: 'Deploy to Cloudflare' },
	{ id: 'verifying', title: 'Verify health' }
];

function deployment(
	phase: DeploymentActivity['phase'],
	options: {
		projectId?: DeploymentActivity['projectId'];
		environment?: DeploymentActivity['environment'];
		step?: DeploymentActivity['step'];
		itemSteps?: DeploymentActivity['steps'];
	} = {}
): DeploymentActivity {
	const { projectId = 'storefront-local', environment = 'prod', step = null, itemSteps = steps } = options;
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

function record(
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
		deployment('complete', { projectId: 'storefront-local', environment: 'prod', step: 'verifying' })
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

test('Summarizes active and failed deployments', () => {
	const examples = [
		{ activeCount: 0, failed: 1, expected: 'No active deployments · 1 failed' },
		{ activeCount: 1, failed: 0, expected: '1 active deployment' },
		{ activeCount: 2, failed: 0, expected: '2 active deployments' }
	];
	const results = examples.map(({ activeCount, failed }) => activitySummary(activeCount, failed));

	expect(results).toEqual(examples.map(({ expected }) => expected));
	record(
		'activitySummary',
		'summarizes-active-and-failed-deployments',
		examples.map(({ activeCount, failed }, index) => ({
			name: `summarize ${activeCount} active deployments and ${failed} standing failures`,
			input: { activeCount, failed },
			output: results[index]
		}))
	);
});

test('Chooses the overall activity light', () => {
	const examples = [
		{ activeCount: 2, failed: 1, total: 3, expected: 'active' },
		{ activeCount: 0, failed: 1, total: 3, expected: 'failed' },
		{ activeCount: 0, failed: 0, total: 3, expected: 'recent' },
		{ activeCount: 0, failed: 0, total: 0, expected: 'idle' }
	];
	const results = examples.map(({ activeCount, failed, total }) =>
		activityLight(activeCount, failed, total)
	);

	expect(results).toEqual(examples.map(({ expected }) => expected));
	record(
		'activityLight',
		'chooses-the-overall-activity-light',
		examples.map(({ activeCount, failed, total }, index) => ({
			name: `light for ${activeCount} active, ${failed} failed and ${total} total deployments`,
			input: { activeCount, failed, total },
			output: results[index]
		}))
	);
});

test('Labels queued, complete and matched deployment steps', () => {
	const items = [
		deployment('queued', { projectId: 'storefront-local', environment: 'dev', step: 'preparing' }),
		deployment('complete', { projectId: 'storefront-local', environment: 'prod', step: 'verifying' }),
		deployment('failed', { projectId: 'storefront-local', environment: 'prod', step: 'uploading' }),
		deployment('building', { projectId: 'storefront-local', environment: 'prod', step: 'building' })
	];
	const results = items.map(phaseLabel);

	expect(results).toEqual([
		'Queued',
		'Deployed',
		'Failed at Deploy to Cloudflare',
		'Build source'
	]);
	record(
		'phaseLabel',
		'labels-queued-complete-and-matched-deployment-steps',
		items.map((item, index) => ({
			name: `label ${item.phase} at ${item.step}`,
			input: { phase: item.phase, step: item.step, steps: item.steps },
			output: results[index]
		}))
	);
});

test('Falls back when no deployment step matches', () => {
	const items = [
		deployment('failed', {
			projectId: 'storefront-local',
			environment: 'prod',
			step: 'uploading',
			itemSteps: [{ id: 'checking', title: 'Run checks' }]
		}),
		deployment('building', {
			projectId: 'storefront-local',
			environment: 'prod',
			itemSteps: []
		})
	];
	const results = items.map(phaseLabel);

	expect(results).toEqual(['Failed', 'Starting']);
	record(
		'phaseLabel',
		'falls-back-when-no-deployment-step-matches',
		items.map((item, index) => ({
			name: `fallback label for ${item.phase} without a matching step`,
			input: { phase: item.phase, step: item.step, steps: item.steps },
			output: results[index]
		}))
	);
});

test('Chooses each deployment row light', () => {
	const items = [
		deployment('queued'),
		deployment('failed'),
		deployment('complete'),
		deployment('building')
	];
	const results = items.map(itemLight);

	expect(results).toEqual(['queued', 'failed', 'recent', 'active']);
	record(
		'itemLight',
		'chooses-each-deployment-row-light',
		items.map((item, index) => ({
			name: `row light for ${item.phase} deployment`,
			input: { phase: item.phase },
			output: results[index]
		}))
	);
});
