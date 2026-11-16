import { mkdirSync, readFileSync, writeFileSync } from 'node:fs';
import { join } from 'node:path';
import { test } from 'vitest';
import { expect } from '../verificationExpect';
import { recordExampleCases } from '../support/recordExampleCases';
import { withTempDir } from '../support/temporary';
import { closeLoopAbandoned } from '../../src/workflows/development-tooling/loop-lifecycle/closeLoop';
import type { CloseLoopInput } from '../../src/workflows/development-tooling/loop-lifecycle/closeLoop.types';

const LOOP = 'fix-login-redirect';
const CLOSED_AT = '2026-11-09T16:40:12.907Z';
const TRACE_PATH = 'specification/loops/fix-login-redirect/trace.ndjson';
const REASON = 'Superseded by the session-cookie loop.';
const OPEN_STEPS = [
	{ id: 'spec', title: 'Identify the failing behavior.', status: 'pending' },
	{ id: 'implement', title: 'Patch the defect without broad refactors.', status: 'pending' }
];
const DONE_STEPS = [
	{
		id: 'spec',
		title: 'Confirm scope, success criteria, constraints, and proof.',
		status: 'complete',
		completedAt: '2026-11-03T10:22:48.104Z',
		evidence: 'Scope agreed: redirect only.'
	}
];

function writeLoopFile(root: string, steps: unknown[]): void {
	const directory = join(root, 'specification', 'loops', LOOP);
	mkdirSync(directory, { recursive: true });
	const state = {
		name: LOOP,
		goal: 'Return users to the page they opened after signing in.',
		createdAt: '2026-11-02T09:14:05.221Z',
		updatedAt: '2026-11-09T09:00:00.000Z',
		steps
	};
	writeFileSync(join(directory, 'loop.json'), `${JSON.stringify(state, null, 2)}\n`);
}

async function captureError(run: () => Promise<unknown>): Promise<unknown> {
	try {
		await run();
		return undefined;
	} catch (caught) {
		return caught;
	}
}

function lastTraceEvent(path: string): unknown {
	const lines = readFileSync(path, 'utf8').trim().split('\n');
	return JSON.parse(lines[lines.length - 1]);
}

test('Abandons an open loop and records the closure in its trace', async () => {
	await withTempDir('close-loop-abandon-', async (root) => {
		writeLoopFile(root, OPEN_STEPS);
		const input: CloseLoopInput = { loop: ` ${LOOP} `, reason: REASON, root, now: () => CLOSED_AT };
		const result = await closeLoopAbandoned(input);

		expect(result.state.closed).toEqual({ status: 'abandoned', reason: REASON, closedAt: CLOSED_AT });
		expect(result.state.updatedAt).toBe(CLOSED_AT);
		expect(result.state.steps).toEqual(OPEN_STEPS);
		expect(result.tracePath).toBe(TRACE_PATH);
		expect(lastTraceEvent(join(root, result.tracePath))).toMatchObject({
			event: 'loop.closed',
			status: 'abandoned',
			loop: LOOP,
			reason: REASON
		});
		recordExampleCases(
			{
				unitId: 'workflow.development-tooling-loop-lifecycle-close-loop',
				symbol: 'closeLoopAbandoned',
				state: 'abandons-an-open-loop-and-records-the-closure-in-its-trace',
				evidence: 'examples-cases',
				file: 'abandons-an-open-loop-and-records-the-closure-in-its-trace.json'
			},
			[
				{
					name: 'abandons a loop with two pending steps and keeps the steps unchanged',
					input: { loop: ` ${LOOP} `, reason: REASON },
					output: {
						closed: result.state.closed,
						updatedAt: result.state.updatedAt,
						steps: result.state.steps,
						tracePath: result.tracePath
					}
				}
			]
		);
	});
});

test('Rejects abandoning a loop that has no pending steps', async () => {
	await withTempDir('close-loop-no-pending-', async (root) => {
		writeLoopFile(root, DONE_STEPS);
		const input: CloseLoopInput = { loop: LOOP, reason: REASON, root };
		const error = await captureError(() => closeLoopAbandoned(input));

		expect(error).toBeInstanceOf(Error);
		expect((error as Error).message).toBe(`Loop "${LOOP}" has no pending steps to abandon.`);
		recordExampleCases(
			{
				unitId: 'workflow.development-tooling-loop-lifecycle-close-loop',
				symbol: 'closeLoopAbandoned',
				state: 'rejects-abandoning-a-loop-that-has-no-pending-steps',
				evidence: 'examples-cases',
				file: 'rejects-abandoning-a-loop-that-has-no-pending-steps.json'
			},
			[
				{
					name: 'loop whose only step is complete is rejected',
					input: { loop: LOOP, reason: REASON },
					error: {
						name: (error as Error).name,
						message: (error as Error).message
					}
				}
			]
		);
	});
});
