import { mkdirSync, writeFileSync } from 'node:fs';
import { join } from 'node:path';
import { test } from 'vitest';
import { expect } from '../verificationExpect';
import { recordExampleCases } from '../support/recordExampleCases';
import { withTempDir } from '../support/temporary';
import { evaluateLoop, renderLoopEvaluation } from '../../src/cli/program/loopEvaluate';
import type { LoopEvaluationResult } from '../../src/cli/program/loopEvaluate.types';

const skippedState = 'records-an-explicit-no-run-evaluation';
const renderState = 'renders-skipped-and-completed-evaluations';

function writeLoop(root: string, state?: Record<string, unknown>): void {
	const directory = join(root, 'specification', 'loops', 'release');
	mkdirSync(directory, { recursive: true });
	writeFileSync(
		join(directory, 'loop.json'),
		JSON.stringify(state ?? {
			name: 'release',
			goal: 'Prepare a release',
			createdAt: '2026-01-01T00:00:00.000Z',
			updatedAt: '2026-01-01T00:00:00.000Z',
			steps: [],
			evaluators: [{ id: 'lint', title: 'Lint', command: 'yarn lint' }]
		})
	);
}

test('Records an explicit no-run evaluation', async () => {
	await withTempDir('loop-evaluate-skip-', async (root) => {
		writeLoop(root);
		const result = await evaluateLoop({
			root,
			loop: 'release',
			runEvaluators: false,
			now: () => '2026-01-02T00:00:00.000Z'
		});

		expect(result).toMatchObject({
			loop: 'release',
			tracePath: 'specification/loops/release/trace.ndjson',
			passed: false,
			results: [],
			skipped: true
		});
		recordExampleCases(
			{
				unitId: 'workflow.loop-evaluate',
				symbol: 'evaluateLoop',
				state: skippedState,
				evidence: 'examples-cases',
				file: `${skippedState}.json`
			},
			[
				{
					name: 'release evaluation records skipped mode and a stable trace path',
					input: { loop: 'release', runEvaluators: false },
					output: {
						loop: result.loop,
						tracePath: result.tracePath,
						passed: result.passed,
						results: result.results,
						skipped: result.skipped
					}
				}
			]
		);
	});
});

test('Throws ExpectedCliError when the loop file is absent', async () => {
	await withTempDir('loop-evaluate-missing-', async (root) => {
		const evaluation = evaluateLoop({ root, loop: 'release' });
		await expect(evaluation).rejects.toThrow('Loop does not exist.');
		recordExampleCases(
			{ unitId: 'workflow.loop-evaluate', symbol: 'evaluateLoop', state: 'throws-expectedclierror-when-the-loop-file-is-absent', evidence: 'examples-cases', file: 'throws-expectedclierror-when-the-loop-file-is-absent.json' },
			[{ name: 'absent loop file is rejected', input: { loop: 'release' }, error: 'Loop does not exist.' }]
		);
	});
});

test('Throws ExpectedCliError when parsed loop state fails validation', async () => {
	await withTempDir('loop-evaluate-invalid-', async (root) => {
		writeLoop(root, { name: 'release' });
		const evaluation = evaluateLoop({ root, loop: 'release' });
		await expect(evaluation).rejects.toThrow('Invalid loop state:');
		recordExampleCases(
			{ unitId: 'workflow.loop-evaluate', symbol: 'evaluateLoop', state: 'throws-expectedclierror-when-parsed-loop-state-fails-validat', evidence: 'examples-cases', file: 'throws-expectedclierror-when-parsed-loop-state-fails-validat.json' },
			[{ name: 'incomplete loop state is rejected', input: { loop: 'release', state: { name: 'release' } }, error: 'Invalid loop state:' }]
		);
	});
});

test('Throws ExpectedCliError when the loaded loop is closed', async () => {
	await withTempDir('loop-evaluate-closed-', async (root) => {
		writeLoop(root, {
			name: 'release',
			goal: 'Prepare a release',
			createdAt: '2026-01-01T00:00:00.000Z',
			updatedAt: '2026-01-01T00:00:00.000Z',
			steps: [],
			evaluators: [],
			closed: {
				status: 'abandoned',
				reason: 'The release was cancelled',
				closedAt: '2026-01-02T00:00:00.000Z'
			}
		});
		const evaluation = evaluateLoop({ root, loop: 'release' });
		await expect(evaluation).rejects.toThrow('is closed as abandoned');
		recordExampleCases(
			{ unitId: 'workflow.loop-evaluate', symbol: 'evaluateLoop', state: 'throws-expectedclierror-when-the-loaded-loop-is-closed', evidence: 'examples-cases', file: 'throws-expectedclierror-when-the-loaded-loop-is-closed.json' },
			[{ name: 'closed loop cannot be evaluated', input: { loop: 'release', closed: { status: 'abandoned', reason: 'The release was cancelled', closedAt: '2026-01-02T00:00:00.000Z' } }, error: 'Loop "release" is closed as abandoned.' }]
		);
	});
});

test('Renders skipped and completed evaluations', () => {
	const skipped: LoopEvaluationResult = {
		loop: 'release',
		tracePath: 'specification/loops/release/trace.ndjson',
		passed: false,
		results: [],
		skipped: true
	};
	const completed: LoopEvaluationResult = {
		loop: 'release',
		tracePath: 'specification/loops/release/trace.ndjson',
		passed: true,
		results: [
			{
				id: 'lint',
				title: 'Lint',
				command: 'yarn lint',
				exitCode: 0,
				stdout: 'Done in 1.8s\n',
				durationMs: 1842,
				stderr: ''
			}
		]
	};
	const skippedText = renderLoopEvaluation(skipped);
	const completedText = renderLoopEvaluation(completed);
	expect(skippedText).toContain('Evaluators: skipped (repository commands disabled)');
	expect(completedText).toContain('[passed] lint - Lint');
	recordExampleCases(
		{
			unitId: 'workflow.loop-evaluate',
			symbol: 'renderLoopEvaluation',
			state: renderState,
			evidence: 'examples-cases',
			file: `${renderState}.json`
		},
		[
			{
				name: 'skipped result uses the dedicated inspection message',
				input: skipped,
				output: skippedText
			},
			{
				name: 'successful evaluator output lists command and exit status',
				input: completed,
				output: completedText
			}
		]
	);
});
