import type { LoopInput } from '../../workflows/development-tooling/loop-state/loopState';

export interface CreateLoopInput extends LoopInput {
	kind?: 'coding' | 'planning';
	plan?: string;
	name: string;
	goal: string;
	from?: string;
	agentModel?: string;
}

export interface AddLoopStepInput extends LoopInput {
	loop: string;
	step: string;
	title: string;
}

export interface CompleteLoopStepInput extends LoopInput {
	loop: string;
	step: string;
	evidence: string;
}

export interface ReadLoopInput extends LoopInput {
	loop: string;
}
