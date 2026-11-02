import { expect, test } from 'vitest';
import type { DeploymentActivity } from '../src/models/development-tooling/Deployment.types';
import {
	activityLight,
	activitySummary,
	itemLight,
	phaseLabel,
	standingFailures
} from '../src/components/development-tooling/deploymentActivityLabels';

const item = (extra: Partial<DeploymentActivity>) =>
	({
		id: 'd',
		projectId: 'p',
		environment: 'production',
		phase: 'running',
		step: null,
		steps: [{ id: 'build', title: 'Build' }],
		...extra
	}) as unknown as DeploymentActivity;

test('a failure stands until a newer deployment to the same destination follows it', () => {
	const newest = item({ id: 'new', phase: 'complete' });
	const old = item({ id: 'old', phase: 'failed' });
	expect(standingFailures([old])).toBe(1);
	expect(standingFailures([newest, old])).toBe(0);
	expect(standingFailures([newest, item({ id: 'x', projectId: 'q', phase: 'failed' })])).toBe(1);
});

test('the summary counts active deployments and standing failures', () => {
	expect(activitySummary(0, 0)).toBe('No active deployments');
	expect(activitySummary(1, 0)).toBe('1 active deployment');
	expect(activitySummary(2, 1)).toBe('2 active deployments · 1 failed');
});

test('the light shows activity before failure before recency', () => {
	expect(activityLight(1, 1, 3)).toBe('active');
	expect(activityLight(0, 1, 3)).toBe('failed');
	expect(activityLight(0, 0, 3)).toBe('recent');
	expect(activityLight(0, 0, 0)).toBe('idle');
});

test('a deployment says where it is and shows its own light', () => {
	expect(phaseLabel(item({ phase: 'queued' }))).toBe('Queued');
	expect(phaseLabel(item({ phase: 'complete' }))).toBe('Deployed');
	expect(phaseLabel(item({ phase: 'failed', step: 'build' as never }))).toBe('Failed at Build');
	expect(phaseLabel(item({ phase: 'failed' }))).toBe('Failed');
	expect(phaseLabel(item({ step: 'build' as never }))).toBe('Build');
	expect(phaseLabel(item({}))).toBe('Starting');
	expect(itemLight(item({ phase: 'queued' }))).toBe('queued');
	expect(itemLight(item({ phase: 'failed' }))).toBe('failed');
	expect(itemLight(item({ phase: 'complete' }))).toBe('recent');
	expect(itemLight(item({}))).toBe('active');
});
