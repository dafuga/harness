import type { LoopInput } from '../../workflows/development-tooling/loop-state/loopState';
import type { LoopStep } from '../../workflows/development-tooling/loop-state/loopState';
import type { LoopEvaluator } from '../../workflows/development-tooling/loop-state/loopState';

export interface NextLoopStepInput extends LoopInput {
	loop: string;
}

export interface NextLoopStepResult {
	loop: string;
	tracePath: string;
	step?: LoopStep;
	evaluator?: LoopEvaluator;
}
