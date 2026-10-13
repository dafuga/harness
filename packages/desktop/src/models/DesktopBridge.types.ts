import type {
	EntityEvidenceQuery,
	EntityEvidenceResult,
	EvidenceArtifactQuery,
	EvidenceArtifactResult
} from './DesktopEvidence.types';
import type {
	NativeHostedStatus,
	CacheStatus,
	ProjectContext,
	DesktopProject,
	ProjectCapabilities,
	HumanCommentDraft,
	HumanCommentResult
} from './ProjectContext.types';
import type {
	ApprovalInfo,
	Category,
	DesignImage,
	EntityDetail,
	HistoryEvent,
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
	listProjects: 'project:list',
	selectProject: 'project:select',
	capabilities: 'project:capabilities',
	addComment: 'thread:comment',
	pendingComments: 'thread:pending',
	hostedStatus: 'hosted:status',
	connectHosted: 'hosted:connect',
	disconnectHosted: 'hosted:disconnect',
	snapshot: 'project:snapshot',
	entity: 'entity:read',
	history: 'entity:history',
	source: 'entity:source',
	image: 'image:read',
	evidence: 'evidence:read',
	artifact: 'evidence:artifact',
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
export const cacheEventChannel = 'cache:status';

export interface RevisionQuery extends ProjectContext {
	branch: string | null;
	commit: string | null;
}
export interface EntityQuery extends ProjectContext {
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
export interface PlanDraft extends ProjectContext {
	category: Category;
	title: string;
	goal: string;
}
export interface ThreadDraft extends ProjectContext {
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
export interface ApprovalDraft extends ProjectContext {
	entityId: string;
	version: string;
	imageHashes: string[];
	contractHash: string;
}

export interface RunRequest extends ProjectContext {
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
	onCacheStatus?(listener: (event: CacheStatus) => void): () => void;
	history?(
		input: EntityQuery & { page: number; branch?: string }
	): Promise<{ entries: HistoryEvent[]; complete: boolean; nextPage: number | null }>;
	hostedStatus?(): Promise<NativeHostedStatus>;
	connectHosted?(): Promise<NativeHostedStatus>;
	disconnectHosted?(): Promise<NativeHostedStatus>;
	pendingComments?(input?: ProjectContext): Promise<HumanCommentResult[]>;
	listProjects?(): Promise<DesktopProject[]>;
	selectProject?(input: { projectId: string }): Promise<ProjectSnapshot>;
	capabilities?(input?: ProjectContext): Promise<ProjectCapabilities>;
	addComment?(input: HumanCommentDraft): Promise<HumanCommentResult>;
	/** Recorded runtime evidence of an entity; absent where a backend cannot read it. */
	evidence?(input: EntityEvidenceQuery): Promise<EntityEvidenceResult>;
	/** The checked bytes of one capture that an evidence answer named. */
	artifact?(input: EvidenceArtifactQuery): Promise<EvidenceArtifactResult>;
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
	cancelRun(input: { runId: string; projectId?: string }): Promise<boolean>;
	onRunEvent(listener: (event: RunEvent) => void): () => void;
}
