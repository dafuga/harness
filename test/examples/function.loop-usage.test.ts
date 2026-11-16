import { test } from 'vitest';
import type { LoopState } from '../../src/core/development-tooling/loopTypes';
import { expect } from '../verificationExpect';
import { recordExampleCases } from '../support/recordExampleCases';
import { loopUsage } from '../../src/services/projects-sessions/project-activity-service/loopUsage';

test('Groups loops by template and summarizes completion and recency', () => {
	const loops = [
		{
			name: 'Draft retry checklist',
			goal: 'Capture retry handling cases',
			createdAt: '2026-11-13T15:00:00.000Z',
			updatedAt: '2026-11-13T15:20:00.000Z',
			steps: [{ id: 'outline-cases', title: 'Outline retry cases', status: 'pending' }]
		},
		{
			name: 'Review provider retries',
			goal: 'Confirm provider retries recover',
			createdAt: '2026-11-12T09:00:00.000Z',
			updatedAt: '2026-11-12T09:12:00.000Z',
			template: 'implementation',
			steps: [
				{ id: 'inspect-retries', title: 'Inspect retry behavior', status: 'complete' },
				{ id: 'verify-recovery', title: 'Verify recovery', status: 'complete' }
			]
		}
	] satisfies LoopState[];
	const output = loopUsage(loops);

	expect(output).toEqual({
		total: 2,
		types: [
			{
				template: 'custom',
				loops: 1,
				complete: 0,
				open: 1,
				lastUsedAt: '2026-11-13T15:20:00.000Z',
				names: ['Draft retry checklist']
			},
			{
				template: 'implementation',
				loops: 1,
				complete: 1,
				open: 0,
				lastUsedAt: '2026-11-12T09:12:00.000Z',
				names: ['Review provider retries']
			}
		]
	});
	recordExampleCases(
		{
			unitId: 'function.loop-usage',
			symbol: 'loopUsage',
			state: 'groups-loops-by-template-and-summarizes-completion-and-recen',
			evidence: 'examples-cases',
			file: 'groups-loops-by-template-and-summarizes-completion-and-recen.json'
		},
		[{ name: 'custom open loop and completed implementation loop', input: loops, output }]
	);
});
