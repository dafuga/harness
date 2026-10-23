import type { NextLoopStepInput, NextLoopStepResult } from './loopNext.types';
import {
	loopPaths,
	loopRoot,
	readLoop
} from '../../workflows/development-tooling/loop-state/loopState';

export async function nextLoopStep(input: NextLoopStepInput): Promise<NextLoopStepResult> {
	const root = loopRoot(input);
	const paths = loopPaths(root, input.loop);
	const state = await readLoop(paths.state);
	const step = state.steps.find((candidate) => candidate.status === 'pending');
	const evaluator = step
		? state.evaluators?.find((candidate) => candidate.step === step.id)
		: undefined;

	return { loop: state.name, tracePath: paths.traceRelative, step, evaluator };
}

export function renderNextLoopStep(result: NextLoopStepResult): string {
	if (!result.step) return `Loop: ${result.loop}\nNext: complete`;
	const lines = [`Loop: ${result.loop}`, `Next: ${result.step.id} - ${result.step.title}`];
	if (result.evaluator) lines.push(`Evaluator: ${result.evaluator.command}`);
	return lines.join('\n');
}

export type { NextLoopStepInput, NextLoopStepResult } from './loopNext.types';
