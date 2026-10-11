import type {
	ApprovalInfo,
	Category,
	DesignImage,
	EntityDetail,
	ProjectSnapshot,
	ProviderId,
	ProviderState,
	Region,
	RunMode,
	SourceChange,
	ThreadInfo,
	ThreadMessage
} from './Desktop.types';

/** The only channels the main process answers. Anything else is refused before any handler. */
export const channels = {
	openProject: 'project:open',
	snapshot: 'project:snapshot',
	entity: 'entity:read',
	source: 'entity:source',
	image: 'image:read',
	createPlan: 'plan:create',
	openThread: 'thread:open',
	messages: 'thread:messages',
	approve: 'design:approve',
	providers: 'providers:list',
	startRun: 'run:start',
	cancelRun: 'run:cancel'
} as const;
export type ChannelName = (typeof channels)[keyof typeof channels];
/** Main to renderer: public progress of a run. */
export const runEventChannel = 'run:event';

export interface RevisionQuery {
	branch: string | null;
	commit: string | null;
}
export interface EntityQuery {
	entityId: string;
	commit: string;
}
export interface SourceQuery extends EntityQuery {
	path: string;
}
export interface SourceFile {
	path: string;
	text: string;
}
export interface ImageQuery extends EntityQuery {
	version: string;
	sha256: string;
}
export interface PlanDraft {
	category: Category;
	title: string;
	goal: string;
}
export interface ThreadDraft {
	entityId: string;
	version: string | null;
	imageSha256: string | null;
	state: string | null;
	viewport: string | null;
	region: Region | null;
}
export interface ThreadQuery extends EntityQuery {
	threadId: string;
}
/** An approval names the exact images and contract it binds; nothing is filled in for it. */
export interface ApprovalDraft {
	entityId: string;
	version: string;
	imageHashes: string[];
	contractHash: string;
}

export interface RunRequest {
	mode: RunMode;
	provider: ProviderId;
	/** An identifier the provider itself listed. It is never replaced by another. */
	model: string;
	effort: string | null;
	entityId: string;
	threadId: string;
	text: string;
	/** Change only: the approved design the code request implements, stated in full. */
	approval: Omit<ApprovalDraft, 'entityId'> | null;
}

export type RunPhase = 'queued' | 'prompting' | 'generating' | 'saving' | 'changing' | 'recording';

/**
 * Public progress of a run: status words, the agent's public text and results. A run that
 * ends never states that tests passed; `verified` is false by construction.
 */
export type RunEvent = { runId: string } & (
	| { kind: 'status'; phase: RunPhase; detail: string }
	| { kind: 'text'; text: string }
	| { kind: 'design'; version: string; images: DesignImage[] }
	| { kind: 'changes'; files: SourceChange[] }
	| { kind: 'failed'; message: string }
	| { kind: 'cancelled' }
	| { kind: 'finished'; summary: string; verified: false }
);

/** What the preload script exposes as `window.harness`. Without it a page is a preview. */
export interface DesktopBridge {
	openProject(): Promise<ProjectSnapshot | null>;
	snapshot(input: RevisionQuery): Promise<ProjectSnapshot>;
	entity(input: EntityQuery): Promise<EntityDetail>;
	source(input: SourceQuery): Promise<SourceFile>;
	image(input: ImageQuery): Promise<Uint8Array>;
	createPlan(input: PlanDraft): Promise<EntityDetail>;
	openThread(input: ThreadDraft): Promise<ThreadInfo>;
	messages(input: ThreadQuery): Promise<ThreadMessage[]>;
	approve(input: ApprovalDraft): Promise<ApprovalInfo>;
	providers(): Promise<ProviderState[]>;
	startRun(input: RunRequest): Promise<{ runId: string }>;
	cancelRun(input: { runId: string }): Promise<boolean>;
	onRunEvent(listener: (event: RunEvent) => void): () => void;
}
