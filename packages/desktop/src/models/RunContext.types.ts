import type { AgentRunner, ImageGenerator } from './AgentRunner.types';
import type { Category, DesignImage, SourceChange, EntityDetail, Revision } from './Desktop.types';
import type { RunRequest } from './DesktopBridge.types';
import type { ProjectSessionService } from '../services/ProjectSessionService';
import type { PlanningPort } from './PlanningPort.types';
export interface RunContext {
	id: string;
	request: RunRequest;
	session: ProjectSessionService;
	root: string;
	revision: Revision;
	entity: EntityDetail;
	planning: PlanningPort;
	runner: AgentRunner;
	generator: ImageGenerator;
	imageModel: string;
	signal: AbortSignal;
	emit: (event: RunEvent) => void;
	failureRecorded?: boolean;
}

/**
 * The plan a creation request became, named so that what asked for it can open it. A run that
 * failed or was cancelled after a draft was written names that draft too, however far it got.
 */
export interface CreatedEntity {
	category: Category;
	entityId: string;
	/** Null while the draft has no thread. */
	threadId: string | null;
	/** True once the original request is written in that thread; only then does it stand for it. */
	requestSaved: boolean;
}

export type RunPhase = 'queued' | 'prompting' | 'generating' | 'saving' | 'changing' | 'recording';

/**
 * Public progress of a run: status words, the agent's public text and results. Host checks
 * and deployment do not grant registered unit verification; `verified` remains false.
 */
export type RunEvent = { runId: string } & (
	| { kind: 'status'; phase: RunPhase; detail: string }
	| { kind: 'text'; text: string }
	| { kind: 'replay'; text: string; detail: string }
	| { kind: 'design'; version: string; images: DesignImage[] }
	| { kind: 'changes'; files: SourceChange[] }
	| { kind: 'failed'; message: string; created?: CreatedEntity }
	| { kind: 'cancelled'; created?: CreatedEntity }
	| { kind: 'finished'; summary: string; verified: false; created?: CreatedEntity }
);
