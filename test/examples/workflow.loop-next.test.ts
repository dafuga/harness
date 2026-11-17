import { mkdirSync, writeFileSync } from 'node:fs';
import { dirname } from 'node:path';
import { test } from 'vitest';
import { expect } from '../verificationExpect';
import { recordExampleCases } from '../support/recordExampleCases';
import { withTempDir } from '../support/temporary';
import { nextLoopStep, renderNextLoopStep } from '../../src/cli/program/loopNext';
import { loopPaths } from '../../src/workflows/development-tooling/loop-state/loopState';
import type { NextLoopStepInput } from '../../src/cli/program/loopNext.types';

const LOOP = 'contract-audit';
const STEPS = [
	{ id: 'collect-inputs', title: 'Collect inputs', status: 'complete' },
	{ id: 'review-contract', title: 'Review the workflow contract', status: 'pending' },
	{ id: 'publish', title: 'Publish the summary', status: 'pending' }
];
const EVALUATORS = [
	{
		id: 'contract-check',
		title: 'Contract check',
		command: 'node scripts/check-contract.js',
		step: 'review-contract'
	}
];

const LOOP_FIELDS = {
	goal: 'Audit the workflow contract',
	createdAt: '2026-11-16T09:00:00.000Z',
	updatedAt: '2026-11-16T09:00:00.000Z'
};

function writeLoop(directory: string, loop: Record<string, unknown>): void {
	const paths = loopPaths(directory, LOOP);
	mkdirSync(dirname(paths.state), { recursive: true });
	writeFileSync(paths.state, JSON.stringify({ ...LOOP_FIELDS, ...loop }));
}

test('Returns the first pending step with its evaluator', async () => {
	await withTempDir('loop-next-pending-', async (directory) => {
		writeLoop(directory, { name: LOOP, steps: STEPS, evaluators: EVALUATORS });
		const input: NextLoopStepInput = { loop: LOOP, root: directory };
		const result = await nextLoopStep(input);

		expect(result.loop).toBe(LOOP);
		expect(result.step?.id).toBe('review-contract');
		expect(result.evaluator?.command).toBe('node scripts/check-contract.js');
		expect(result.tracePath).toContain(LOOP);
		recordExampleCases(
			{
				unitId: 'workflow.loop-next',
				symbol: 'nextLoopStep',
				state: 'returns-the-first-pending-step-with-its-evaluator',
				evidence: 'examples-cases',
				file: 'returns-the-first-pending-step-with-its-evaluator.json'
			},
			[
				{
					name: 'first pending step is returned with the evaluator configured for it',
					input: { loop: LOOP },
					output: { loop: result.loop, step: result.step, evaluator: result.evaluator }
				}
			]
		);
	});
});

test('Reports no step once every step is complete', async () => {
	await withTempDir('loop-next-complete-', async (directory) => {
		const steps = STEPS.map((step) => ({ ...step, status: 'complete' }));
		writeLoop(directory, { name: LOOP, steps, evaluators: EVALUATORS });
		const result = await nextLoopStep({ loop: LOOP, root: directory });
		const text = renderNextLoopStep(result);

		expect(result.step).toBeUndefined();
		expect(result.evaluator).toBeUndefined();
		expect(text).toBe('Loop: contract-audit\nNext: complete');
		recordExampleCases(
			{
				unitId: 'workflow.loop-next',
				symbol: 'nextLoopStep',
				state: 'reports-no-step-once-every-step-is-complete',
				evidence: 'examples-cases',
				file: 'reports-no-step-once-every-step-is-complete.json'
			},
			[
				{
					name: 'all steps complete yields no step and the complete line',
					input: { loop: LOOP },
					output: { loop: result.loop, step: null, rendered: text }
				}
			]
		);
	});
});

test('Renders the next step and evaluator command', async () => {
	await withTempDir('loop-next-render-', async (directory) => {
		writeLoop(directory, { name: LOOP, steps: STEPS, evaluators: EVALUATORS });
		const result = await nextLoopStep({ loop: LOOP, root: directory });
		const text = renderNextLoopStep(result);

		expect(text).toBe(
			'Loop: contract-audit\nNext: review-contract - Review the workflow contract\nEvaluator: node scripts/check-contract.js'
		);
		recordExampleCases(
			{
				unitId: 'workflow.loop-next',
				symbol: 'renderNextLoopStep',
				state: 'renders-the-next-step-and-evaluator-command',
				evidence: 'examples-cases',
				file: 'renders-the-next-step-and-evaluator-command.json'
			},
			[
				{
					name: 'pending step with evaluator renders three lines',
					input: { loop: LOOP, step: 'review-contract' },
					output: text
				}
			]
		);
	});
});

test('Rejects when loop.json is missing', async () => {
	await withTempDir('loop-next-missing-', async (directory) => {
		let error: unknown;
		try {
			await nextLoopStep({ loop: LOOP, root: directory });
		} catch (caught) {
			error = caught;
		}

		expect(error).toBeInstanceOf(Error);
		recordExampleCases(
			{
				unitId: 'workflow.loop-next',
				symbol: 'nextLoopStep',
				state: 'rejects-when-loop-json-is-missing',
				evidence: 'examples-cases',
				file: 'rejects-when-loop-json-is-missing.json'
			},
			[
				{
					name: 'loop without a loop.json state file rejects',
					input: { loop: LOOP },
					error: { name: (error as Error).name }
				}
			]
		);
	});
});
