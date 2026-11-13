// @harness-uid u_22qpghpzat
import type { LoopInput } from '../loop-state/loopState.types';
export interface CloseLoopInput extends LoopInput {
	loop: string;
	reason: string;
}
