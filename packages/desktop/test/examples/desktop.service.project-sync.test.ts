import { test } from 'vitest';
import { expect } from '../../../../test/verificationExpect';
import { recordExampleCases } from '../../../../test/support/recordExampleCases';
import { ProjectSyncService } from '../../src/services/projects-sessions/ProjectSyncService';
import type { ProjectSyncOptions } from '../../src/services/projects-sessions/ProjectSyncService.types';

test('Syncs active account projects and ignores inactive requests', async () => {
	let refreshes = 0;
	const options: ProjectSyncOptions = {
		interval: 60_000,
		refresh: async () => {
			refreshes += 1;
			return { account: 'example-account', projectCount: 2 };
		}
	};
	const service = new ProjectSyncService(options);
	const inactiveResult = await service.sync();
	service.start();
	try {
		await service.sync();
		expect(refreshes).toBe(1);
		const output = { inactive: inactiveResult, activeRefreshes: refreshes };
		recordExampleCases(
			{
				unitId: 'desktop.service.project-sync',
				symbol: 'sync',
				state: 'syncs-active-account-projects-and-ignores-inactive-requests',
				evidence: 'examples-cases',
				file: 'syncs-active-account-projects-and-ignores-inactive-requests.json'
			},
			[
				{
				name: 'Inactive sync is immediate and active sync refreshes the account projects',
				input: {
					inactiveCall: 'sync before start',
					options: { interval: 60_000, exampleAccount: 'example-account' }
				},
				output
			}
			]
		);
	} finally {
		service.stop();
	}
});
