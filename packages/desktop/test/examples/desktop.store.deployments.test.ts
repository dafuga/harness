import { test } from 'vitest';
import { expect } from '../../../../test/verificationExpect';
import { recordExampleCases } from '../../../../test/support/recordExampleCases';
import { createDeploymentsStore } from '../../src/lib/development-tooling/stores/deployments.svelte';

const status = {
	environment: 'prod' as const,
	receipt: null,
	available: true,
	reason: ''
};

const plan = {
	id: 'plan-42',
	environment: 'prod' as const,
	commit: 'abc123',
	branch: 'main',
	adapter: 'static',
	target: 'production',
	steps: ['build', 'publish'],
	blockers: [],
	expiresAt: '2026-12-01T00:00:00.000Z'
};

function makeWorkspace(overrides: Record<string, unknown> = {}) {
	const remembered: Array<Record<string, unknown>> = [];
	const workspace = {
		projectId: 'project-7',
		local: true,
		offline: false,
		busy: false,
		capabilities: { agents: true },
		context: { projectId: 'project-7' },
		snapshot: { revision: { commit: 'abc123' } },
		activity: {
			items: remembered,
			remember(job: Record<string, unknown>) {
				remembered.push(job);
			}
		},
		bridge: {
			deploymentActivities: async () => [],
			deploymentStatus: async () => [status],
			planDeployment: async () => plan,
			startDeployment: async () => ({ id: 'job-9', receipt: { id: 'receipt-9' } })
		},
		...overrides
	};
	return workspace as unknown as Parameters<typeof createDeploymentsStore>[0];
}

test('selects production deployment status after refresh', async () => {
	const store = createDeploymentsStore(makeWorkspace());
	store.choose('prod');
	await store.refresh();

	expect(store.viewing).toBe(true);
	expect(store.selected).toEqual(status);
	expect(store.loading).toBe(false);
	recordExampleCases(
		{
			unitId: 'desktop.store.deployments',
			symbol: 'choose and refresh',
			state: 'selects-production-deployment-status-after-refresh',
			evidence: 'examples-cases',
			file: 'selects-production-deployment-status-after-refresh.json'
		},
		[
			{
				name: 'select prod and load its available status',
				input: { environment: 'prod', projectId: 'project-7' },
				output: { environment: store.environment, viewing: store.viewing, selected: store.selected }
			}
		]
	);
});

test('reviews the current commit for production', async () => {
	const store = createDeploymentsStore(makeWorkspace());
	await store.review();

	expect(store.supported).toBe(true);
	expect(store.plan).toEqual(plan);
	expect(store.error).toBe('');
	recordExampleCases(
		{
			unitId: 'desktop.store.deployments',
			symbol: 'review',
			state: 'reviews-the-current-commit-for-production',
			evidence: 'examples-cases',
			file: 'reviews-the-current-commit-for-production.json'
		},
		[
			{
				name: 'review the workspace snapshot for prod',
				input: { projectId: 'project-7', commit: 'abc123', environment: 'prod' },
				output: { planId: store.plan?.id, commit: store.plan?.commit, blockers: store.plan?.blockers }
			}
		]
	);
});

test('executes an eligible production plan', async () => {
	const workspace = makeWorkspace();
	const store = createDeploymentsStore(workspace);
	store.plan = plan;
	await store.execute();

	expect(store.job).toMatchObject({ id: 'job-9' });
	expect(store.plan).toBeNull();
	expect(store.pending).toBe(true);
	recordExampleCases(
		{
			unitId: 'desktop.store.deployments',
			symbol: 'execute',
			state: 'executes-an-eligible-production-plan',
			evidence: 'examples-cases',
			file: 'executes-an-eligible-production-plan.json'
		},
		[
			{
				name: 'start plan-42 and retain its active job',
				input: { projectId: 'project-7', planId: 'plan-42', busy: false },
				output: { job: store.job, pending: store.pending, plan: store.plan }
			}
		]
	);
});
