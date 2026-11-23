import { test } from 'vitest';
import { expect } from '../verificationExpect';
import { recordExampleCases } from '../support/recordExampleCases';
import type { LoopState } from '../../src/core/development-tooling/loopTypes';

test('Loop state preserves policy ordered pending steps evaluators', () => {
	const loop = {
		completion: { version: 1, kind: 'coding', plan: 'Implement the parser' },
		name: 'parser regression',
		goal: 'Keep malformed input from being accepted',
		createdAt: '2026-01-10T09:00:00.000Z',
		updatedAt: '2026-01-10T09:00:00.000Z',
		enforceOrder: true,
		regressionCommits: 1,
		steps: [
			{ id: 'red', title: 'Show malformed input fails', status: 'pending' },
			{ id: 'green', title: 'Repair parser behavior', status: 'pending' }
		],
		evaluators: [
			{
				id: 'focused-test',
				title: 'Parser regression',
				command: 'bun test parser.test.ts',
				step: 'red',
				timeoutMs: 5000
			}
		],
		closed: {
			status: 'abandoned',
			reason: 'The upstream behavior changed',
			closedAt: '2026-01-11T10:00:00.000Z'
		}
	} satisfies LoopState;

	expect(loop.steps.map(({ status }) => status)).toEqual(['pending', 'pending']);
	expect(loop).toMatchObject({
		completion: { version: 1, kind: 'coding' },
		evaluators: [{ id: 'focused-test', step: 'red' }],
		closed: { status: 'abandoned', reason: 'The upstream behavior changed' }
	});
	recordExampleCases(
		{
			unitId: 'function.development-tooling-loop-types',
			symbol: 'LoopState',
			state: 'loop-state-preserves-policy-ordered-pending-steps-evaluators',
			evidence: 'examples-cases',
			file: 'loop-state-preserves-policy-ordered-pending-steps-evaluators.json'
		},
		[
			{
				name: 'ordered regression loop was explicitly abandoned before steps completed',
				input: { name: loop.name, stepIds: loop.steps.map(({ id }) => id) },
				output: {
					completion: loop.completion,
					steps: loop.steps,
					evaluators: loop.evaluators,
					closed: loop.closed
				}
			}
		]
	);
});
