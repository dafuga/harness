import type { LiveActivity } from '../../../../../src/core/activityTypes';
import type { ProjectContext } from '../projects-sessions/ProjectContext.types';
import type { CacheStatus } from '../projects-sessions/ProjectContext.types';
import type { NativeHostedStatus } from '../projects-sessions/ProjectContext.types';
import type { HumanCommentResult } from '../projects-sessions/ProjectContext.types';
import type { DesktopProject } from '../projects-sessions/ProjectContext.types';
import type { ProjectCapabilities } from '../projects-sessions/ProjectContext.types';
import type { HumanCommentDraft } from '../projects-sessions/ProjectContext.types';
import type { ContractField } from './Desktop.types';
import type { Category } from './Desktop.types';
import type { Region } from './Desktop.types';
import type { RunMode } from './Desktop.types';
import type { ProviderId } from './Desktop.types';
import type { HistoryEvent } from './Desktop.types';
import type { ProjectSnapshot } from './Desktop.types';
import type { EntityDetail } from './Desktop.types';
import type { ThreadInfo } from './Desktop.types';
import type { ThreadMessage } from './Desktop.types';
import type { ApprovalInfo } from './Desktop.types';
import type { ProviderState } from './Desktop.types';
import type { DeploymentEnvironment } from '../Deployment.types';
import type { DeploymentBridge } from '../Deployment.types';
import type { GameDesktopBridge } from '../game-authoring/GameDesktopBridge.types';
import type { EntityEvidenceQuery } from '../verification-evidence/DesktopEvidence.types';
import type { EntityEvidenceResult } from '../verification-evidence/DesktopEvidence.types';
import type { EvidenceArtifactQuery } from '../verification-evidence/DesktopEvidence.types';
import type { EvidenceArtifactResult } from '../verification-evidence/DesktopEvidence.types';
import type { ProjectTaskRequest } from '../projects-sessions/ProjectTask.types';
import type { RunEvent } from './RunContext.types';
import type { channels } from './DesktopBridgeValues';

export type ChannelName = (typeof channels)[keyof typeof channels];

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

/** What the preload script exposes as `window.harness`. Without it a page is a preview. */
export interface DesktopBridge extends GameDesktopBridge, DeploymentBridge {
	/** Live registrations of the selected repository; absent on unsupported hosts. */
	agentActivity?(input: ProjectContext): Promise<Pick<LiveActivity, 'sampledAt' | 'agents'>>;
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
export {
	type CreatedEntity,
	type RunPhase,
	type RunEvent,
	type ProjectTaskRequest,
	channels,
	runEventChannel,
	cacheEventChannel
} from './DesktopBridgeValues';
