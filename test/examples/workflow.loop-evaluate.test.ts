import { writeFileSync } from 'node:fs';
import { join } from 'node:path';
import { test } from 'vitest';
import { expect } from '../verificationExpect';
import { recordExampleCases } from '../support/recordExampleCases';
import { withTempDir } from '../support/temporary';
import { evaluateLoop, renderLoopEvaluation } from '../../src/cli/program/loopEvaluate';
import type { LoopEvaluationResult } from '../../src/cli/program/loopEvaluate.types';

const skippedState = 'records-an-explicit-no-run-evaluation';
const renderState = 'renders-skipped-and-completed-evaluations';

function writeLoop(root: string): void {
	const directory = join(root, 'specification', 'loops', 'release');
	writeFileSync(
		join(directory, 'loop.json'),
		JSON.stringify({
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
		const directory = join(root, 'specification', 'loops', 'release');
		const { mkdirSync } = await import('node:fs');
		mkdirSync(directory, { recursive: true });
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
