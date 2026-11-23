import { test } from 'vitest';
import { expect } from '../../../../test/verificationExpect';
import { recordExampleCases } from '../../../../test/support/recordExampleCases';
import { watchDeploymentActivities } from '../../src/utils/projects-sessions/watchDeploymentActivities';
import type { Events } from '../../src/utils/projects-sessions/watchDeploymentActivities.types';

test('delivers activities with the poll version while the bridge remains current', async () => {
	const activities = [
		{
			id: 'deployment-1',
			projectName: 'Example app',
			environment: 'dev',
			commit: 'abc123',
			branch: 'main',
			steps: [],
			step: null,
			error: null,
			receipt: null,
			createdAt: '2026-01-01T10:00:00.000Z',
			startedAt: null,
			updatedAt: '2026-01-01T10:00:00.000Z',
			finishedAt: null,
			sourceEnvironment: null,
			projectId: 'project-1'
		}
	];
	const bridge = { deploymentActivities: () => Promise.resolve(activities) };
	const workspace = { local: true, bridge } as unknown as Parameters<
		typeof watchDeploymentActivities
	>[0];
	let delivered: { count: number; version: number } | undefined;
	const events: Events = {
		version: () => 7,
		received: (items, version) => (delivered = { count: items.length, version }),
		failed: () => undefined
	};
	const stop = watchDeploymentActivities(workspace, events);
	await Promise.resolve();
	stop();

	expect(delivered).toEqual({ count: 1, version: 7 });
	recordExampleCases(
		{
			unitId: 'desktop.function.watch-deployment-activities',
			symbol: 'watchDeploymentActivities',
			state: 'delivers-activities-with-the-poll-version-while-the-bridge-r',
			evidence: 'examples-cases',
			file: 'delivers-activities-with-the-poll-version-while-the-bridge-r.json'
		},
		[
			{
				name: 'deliver one current deployment activity',
				input: { local: true, version: 7, activityIds: ['deployment-1'] },
				output: delivered
			}
		]
	);
});
