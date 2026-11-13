// @harness-uid u_oprumo3dm2
import type { LoopInput } from '../loop-state/loopState.types';
import type { LoopActivity } from './loopActivity.types';
export interface ListLoopsInput extends LoopInput {
	staleDays?: number;
}
export interface OpenLoop extends LoopActivity {
	name: string;
	goal: string;
}
export interface UnreadableLoop {
	name: string;
	error: string;
}
export interface OpenLoopList {
	loops: OpenLoop[];
	unreadable: UnreadableLoop[];
}
