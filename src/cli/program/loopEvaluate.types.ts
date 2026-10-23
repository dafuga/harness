import type { LoopInput } from '../../workflows/development-tooling/loop-state/loopState';

export interface LoopEvaluationResult {
	loop: string;
	tracePath: string;
	passed: boolean;
	results: LoopCommandResult[];
}

export interface LoopCommandResult {
	id: string;
	title: string;
	command: string;
	exitCode: number;
	stdout: string;
	durationMs?: number;
	stderr: string;
}

export interface EvaluateLoopInput extends LoopInput {
	loop: string;
}
