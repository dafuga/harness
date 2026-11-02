// @harness-uid u_2h4nm5fwn7
import type { LoopState } from '../../../core/development-tooling/loopTypes';
export type {
	LoopStep,
	LoopEvaluator,
	LoopState
} from '../../../core/development-tooling/loopTypes';

export interface LoopStatus {
	state: LoopState;
	tracePath: string;
}

export interface LoopInput {
	root?: string;
	now?: () => string;
}

export interface LoopPaths {
	dir: string;
	state: string;
	trace: string;
	traceRelative: string;
}
