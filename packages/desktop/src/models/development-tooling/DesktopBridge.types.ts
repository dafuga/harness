import type { DeploymentEnvironment, DeploymentBridge } from '../Deployment.types';
import type { ProjectTaskRequest } from '../projects-sessions/ProjectTask.types';
export type { ProjectTaskRequest } from '../projects-sessions/ProjectTask.types';
import type {
	EntityEvidenceQuery,
	EntityEvidenceResult,
	EvidenceArtifactQuery,
	EvidenceArtifactResult
} from '../verification-evidence/DesktopEvidence.types';
import type {
	NativeHostedStatus,
	CacheStatus,
	ProjectContext,
	DesktopProject,
	ProjectCapabilities,
	HumanCommentDraft,
	HumanCommentResult
} from '../projects-sessions/ProjectContext.types';
import type {
	ApprovalInfo,
	Category,
	ContractField,
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
export const channels = {
	deploymentStatus: 'deployment:status',
	deploymentActivities: 'deployment:activities',
	startDeployment: 'deployment:start',
	deploymentProgress: 'deployment:progress',
	planDeployment: 'deployment:plan',
	deploy: 'deployment:execute',
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
/** What a new plan is proposed to take, give and refuse; states and viewports are not proposed. */
export interface ProposedContract {
	inputs: ContractField[];
	outputs: ContractField[];
	errors: string[];
}
export interface PlanDraft extends ProjectContext {
	category: Category;
	title: string;
	goal: string;
	/** A contract that was checked before it came here; without one the plan starts with none. */
	contract?: ProposedContract;
}
export interface ThreadDraft extends ProjectContext {
	entityId: string;
	version: string | null;
	imageSha256: string | null;
	state: string | null;
	viewport: string | null;
	region: Region | null;
	/** Checked against the option holding the image when given; derived from it otherwise. */
	option?: string;
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
	/** The one design option approved, required when the version has options. */
	option?: string;
}
export interface RunRequest extends ProjectContext {
	environment?: DeploymentEnvironment;
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
	/** Plan only: separately generated design options of a visual unit, 1 to 10; 3 if left out. */
	designOptions?: number;
}

/** A request for something new. The agent proposes what it is, and a plan is made of that. */
export interface ProjectRunRequest extends ProjectContext {
	intent: 'create';
	/** Always stated: something new is never added to whichever project happens to be open. */
	projectId: string;
	/** The catalog the request was made in: a hint for the agent, never a decision. */
	category: Category;
	/** A Change implements the approved design of an entity that exists; this is a Plan. */
	mode: 'plan';
	provider: ProviderId;
	/** An identifier the provider itself listed. It is never replaced by another. */
	model: string;
	effort: string | null;
	text: string;
	/** Separately generated design options when the plan is visual, 1 to 10; 3 if left out. */
	designOptions?: number;
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

/** What the preload script exposes as `window.harness`. Without it a page is a preview. */
export interface DesktopBridge extends DeploymentBridge {
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
	startRun(input: RunRequest | ProjectRunRequest | ProjectTaskRequest): Promise<{ runId: string }>;
	cancelRun(input: { runId: string; projectId?: string }): Promise<boolean>;
	onRunEvent(listener: (event: RunEvent) => void): () => void;
}
