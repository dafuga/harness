// @harness-uid u_dzjufezgca
/** One stored proof: the text `loop complete` writes, or a record kept as it was authored. */
export type LoopEvidenceEntry = string | Record<string, unknown>;

/** Stored loops hold one proof or a list of them; reads keep the stored shape. */
export type LoopStepEvidence = LoopEvidenceEntry | LoopEvidenceEntry[];

export interface LoopStep {
	id: string;
	title: string;
	status: 'pending' | 'complete';
	completedAt?: string;
	evidence?: LoopStepEvidence;
}

export interface LoopEvaluator {
	id: string;
	title: string;
	command: string;
	step?: string;
}

export interface LoopClosure {
	status: 'abandoned';
	reason: string;
	closedAt: string;
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
	closed?: LoopClosure;
}
