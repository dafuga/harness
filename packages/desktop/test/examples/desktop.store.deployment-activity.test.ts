import { test } from 'vitest';
import { expect } from '../../../../test/verificationExpect';
import { recordExampleCases } from '../../../../test/support/recordExampleCases';
import { createDeploymentActivityStore } from '../../src/lib/development-tooling/stores/deploymentActivity.svelte';

function workspace() {
	return { projectId: 'project-1' } as Parameters<typeof createDeploymentActivityStore>[0];
}

function activity(id: string, finishedAt: string | null) {
	return {
		id,
		projectId: 'project-1',
		projectName: 'Example project',
		environment: 'dev',
		sourceEnvironment: null,
		commit: 'abc1234',
		branch: 'main',
		steps: [],
		step: null,
		error: null,
		receipt: null,
		createdAt: '2026-01-01T10:00:00.000Z',
		startedAt: '2026-01-01T10:01:00.000Z',
		updatedAt: '2026-01-01T10:02:00.000Z',
		finishedAt
	} as unknown as Parameters<ReturnType<typeof createDeploymentActivityStore>['remember']>[0];
}

test('remembers latest deployments and counts active items', () => {
	const store = createDeploymentActivityStore(workspace());
	const first = activity('deploy-1', null);
	const second = activity('deploy-2', '2026-01-01T10:05:00.000Z');
	const replacement = activity('deploy-1', '2026-01-01T10:06:00.000Z');

	expect(store.items).toEqual([]);
	expect(store.error).toBe('');
	store.remember(first);
	const afterFirst = { ids: store.items.map(({ id }) => id), activeCount: store.activeCount };
	store.remember(second);
	const afterSecond = { ids: store.items.map(({ id }) => id), activeCount: store.activeCount };
	store.remember(replacement);
	const afterReplacement = {
		ids: store.items.map(({ id }) => id),
		finishedAt: store.items[0]?.finishedAt,
		activeCount: store.activeCount
	};

	expect(afterFirst).toEqual({ ids: ['deploy-1'], activeCount: 1 });
	expect(afterSecond).toEqual({ ids: ['deploy-2', 'deploy-1'], activeCount: 1 });
	expect(afterReplacement).toEqual({
		ids: ['deploy-1', 'deploy-2'],
		finishedAt: '2026-01-01T10:06:00.000Z',
		activeCount: 0
	});

	recordExampleCases(
		{
			unitId: 'desktop.store.deployment-activity',
			symbol: 'remember',
			state: 'remembers-latest-deployments-and-counts-active-items',
			evidence: 'examples-cases',
			file: 'remembers-latest-deployments-and-counts-active-items.json'
		},
		[
			{
				name: 'initial store has no activities',
				input: {},
				output: { items: [], error: '', activeCount: 0 }
			},
			{ name: 'remember an active deployment', input: first, output: afterFirst },
			{ name: 'prepend a finished deployment', input: second, output: afterSecond },
			{
				name: 'replace the existing deployment by id',
				input: replacement,
				output: afterReplacement
			}
		]
	);
});
