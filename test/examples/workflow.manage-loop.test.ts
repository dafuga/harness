import { test } from 'vitest';
import { expect } from '../verificationExpect';
import { recordExampleCases } from '../support/recordExampleCases';
import { withTempDir } from '../support/temporary';
import {
	createLoop,
	addLoopStep,
	completeLoopStep,
	readLoopStatus,
	renderLoopStatus
} from '../../src/cli/program/manageLoop';
import type {
	CreateLoopInput,
	AddLoopStepInput,
	CompleteLoopStepInput,
	ReadLoopInput
} from '../../src/cli/program/manageLoop.types';

const UNIT_ID = 'workflow.manage-loop';
const LOOP = 'release-readiness';
const GOAL = 'Verify that the release checklist is complete.';
const STEP = 'run-smoke-checks';
const STEP_TITLE = 'Run the smoke checks.';
const EVIDENCE = 'Smoke checks passed on the release candidate.';
const MODEL = 'example-model';
const fixtureNow = () => '2026-11-15T09:00:00.000Z';

function createInput(root: string): CreateLoopInput {
	return { root, name: LOOP, goal: GOAL, now: fixtureNow, agentModel: MODEL };
}

function addInput(root: string): AddLoopStepInput {
	return { root, loop: LOOP, step: STEP, title: STEP_TITLE, now: fixtureNow };
}

function completeInput(root: string): CompleteLoopStepInput {
	return { root, loop: LOOP, step: STEP, evidence: EVIDENCE, now: fixtureNow };
}

function readInput(root: string): ReadLoopInput {
	return { root, loop: LOOP };
}

function meta(symbol: string, state: string) {
	return { unitId: UNIT_ID, symbol, state, evidence: 'examples-cases', file: `${state}.json` };
}

function brief(status: { state: { name: string; steps: Array<{ id: string; status: string }> } }) {
	return {
		name: status.state.name,
		steps: status.state.steps.map(({ id, status: state }) => ({ id, status: state }))
	};
}

async function captureError(action: () => Promise<unknown>): Promise<Error> {
	try {
		await action();
	} catch (caught) {
		return caught as Error;
	}
	throw new Error('Expected the action to reject.');
}

test('Creates a release loop with no steps', async () => {
	await withTempDir('manage-loop-create-', async (directory) => {
		const status = await createLoop(createInput(directory));
		expect(status.state.name).toBe(LOOP);
		expect(status.state.goal).toBe(GOAL);
		expect(status.state.steps).toEqual([]);
		expect(status.tracePath).toContain(LOOP);
		recordExampleCases(meta('createLoop', 'creates-a-release-loop-with-no-steps'), [
			{
				name: 'new loop with a goal and no template',
				input: { name: LOOP, goal: GOAL, agentModel: MODEL },
				output: { ...brief(status), tracePath: status.tracePath }
			}
		]);
	});
});

test('Adds a pending step to an open loop', async () => {
	await withTempDir('manage-loop-add-', async (directory) => {
		await createLoop(createInput(directory));
		const status = await addLoopStep(addInput(directory));
		expect(status.state.steps).toHaveLength(1);
		expect(status.state.steps[0]).toMatchObject({ id: STEP, status: 'pending' });
		recordExampleCases(meta('addLoopStep', 'adds-a-pending-step-to-an-open-loop'), [
			{
				name: 'adds the smoke-check step to the release loop',
				input: { loop: LOOP, step: STEP, title: STEP_TITLE },
				output: brief(status)
			}
		]);
	});
});

test('Completes a step with its evidence', async () => {
	await withTempDir('manage-loop-complete-', async (directory) => {
		await createLoop(createInput(directory));
		await addLoopStep(addInput(directory));
		const status = await completeLoopStep(completeInput(directory));
		expect(status.state.steps[0]).toMatchObject({
			id: STEP,
			status: 'complete',
			completedAt: '2026-11-15T09:00:00.000Z',
			evidence: EVIDENCE
		});
		recordExampleCases(meta('completeLoopStep', 'completes-a-step-with-its-evidence'), [
			{
				name: 'completes the smoke-check step with release evidence',
				input: { loop: LOOP, step: STEP, evidence: EVIDENCE },
				output: brief(status)
			}
		]);
	});
});

test('Rejects a duplicate step id', async () => {
	await withTempDir('manage-loop-duplicate-', async (directory) => {
		await createLoop(createInput(directory));
		await addLoopStep(addInput(directory));
		const error = await captureError(() => addLoopStep(addInput(directory)));
		expect(error.message).toContain('already exists');
		recordExampleCases(meta('addLoopStep', 'rejects-a-duplicate-step-id'), [
			{
				name: 'second add of the same step id is refused',
				input: { loop: LOOP, step: STEP, title: STEP_TITLE },
				error: { name: error.name, message: error.message }
			}
		]);
	});
});

test('Reads back the persisted loop status', async () => {
	await withTempDir('manage-loop-read-', async (directory) => {
		await createLoop(createInput(directory));
		await addLoopStep(addInput(directory));
		const status = await readLoopStatus(readInput(directory));
		expect(status.state.name).toBe(LOOP);
		expect(status.state.steps).toHaveLength(1);
		recordExampleCases(meta('readLoopStatus', 'reads-back-the-persisted-loop-status'), [
			{
				name: 'reads the release loop after one step was added',
				input: { loop: LOOP },
				output: { ...brief(status), tracePath: status.tracePath }
			}
		]);
	});
});

test('Renders the loop status with completed evidence', () => {
	const text = renderLoopStatus(
		{
			state: {
				name: LOOP,
				goal: 'Verify the release checklist.',
				createdAt: '2026-11-14T09:00:00.000Z',
				updatedAt: '2026-11-15T09:00:00.000Z',
				steps: [
					{
						id: 'prepare-release',
						title: 'Prepare release notes',
						status: 'complete',
						completedAt: '2026-11-15T09:00:00.000Z',
						evidence: 'Release notes reviewed.'
					},
					{ id: STEP, title: 'Run smoke checks', status: 'pending' }
				]
			},
			tracePath: 'specification/loops/release-readiness/trace.ndjson'
		},
		'2026-11-15T12:00:00.000Z'
	);
	expect(text).toContain(`Loop: ${LOOP}`);
	expect(text).toContain('  [complete] prepare-release - Prepare release notes');
	expect(text).toContain('    evidence: Release notes reviewed.');
	expect(text).toContain(`  [pending] ${STEP} - Run smoke checks`);
	recordExampleCases(meta('renderLoopStatus', 'renders-the-loop-status-with-completed-evidence'), [
		{
			name: 'one complete step with evidence and one pending step',
			input: { loop: LOOP, now: '2026-11-15T12:00:00.000Z' },
			output: text
		}
	]);
});
