export interface LoopStep {
	id: string;
	title: string;
	status: 'pending' | 'complete';
	completedAt?: string;
	evidence?: string;
}

export interface LoopEvaluator {
	id: string;
	title: string;
	command: string;
	step?: string;
}

export interface LoopState {
	/** Completion policy is versioned; old traces are not rewritten as new evidence. */
	completion?: { version: 1; kind: 'coding' | 'planning'; plan?: string };
	agentModel?: string;
	name: string;
	goal: string;
	createdAt: string;
	updatedAt: string;
	template?: string;
	templateLineage?: string[];
	enforceOrder?: boolean;
	/** Versioned opt-in: older loop evidence remains visible without inventing missing commits. */
	regressionCommits?: 1;
	steps: LoopStep[];
	evaluators?: LoopEvaluator[];
}

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
