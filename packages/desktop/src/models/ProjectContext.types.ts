import type { DesktopBridge } from './DesktopBridge.types';
import type {
	EntityEvidenceQuery,
	EntityEvidenceResult,
	EvidenceArtifactQuery,
	EvidenceArtifactResult
} from './DesktopEvidence.types';
import type {
	AddCommentInput,
	CacheIdentity,
	CommittedThread
} from '../../../collaboration/src/models/Collaboration.types';
import type {
	EntityQuery,
	ImageQuery,
	SourceQuery,
	ThreadQuery,
	SourceFile
} from './DesktopBridge.types';
import type { EntityDetail, ThreadMessage, HistoryEvent } from './Desktop.types';
import type { ProjectSnapshot } from './Desktop.types';
/** Omitted projectId preserves the selected local project behavior. */
export interface ProjectContext {
	projectId?: string;
}
export interface ProjectCapabilities {
	comments: boolean;
	agents: boolean;
	planning: boolean;
	approval: boolean;
	source: 'local' | 'github';
	reason?: string;
}
export interface DesktopProject {
	id: string;
	name: string;
	kind: 'local' | 'shared';
	root?: string;
}
export interface CacheStatus {
	projectId: string;
	status: 'fresh' | 'offline' | 'denied';
	cachedAt?: string;
}
export interface CacheProvenance {
	cachedAt?: string;
	readOnly?: boolean;
	identity: CacheIdentity;
	status: 'fresh' | 'offline' | 'miss';
	/** Local revisions are never silently pushed or described as published. */
	publication: 'local-unpublished' | 'remote' | 'unknown';
}
export type HumanCommentDraft = Omit<AddCommentInput, 'projectId'> & ProjectContext;
export type HumanCommentResult =
	| {
			kind: 'pending';
			projectId: string;
			draftId: string;
			savedAt: string;
			input: HumanCommentDraft;
			reason: string;
	  }
	| { kind: 'shared'; projectId: string; thread: CommittedThread };
/** Main-process injected transport. It owns verified Google session handling; no renderer Actor. */
export interface RemoteProjectPort {
	agent?(method: string, input: unknown, projectId: string): Promise<unknown>;
	onRunEvent?(listener: Parameters<DesktopBridge['onRunEvent']>[0]): () => void;
	evidence?(input: EntityEvidenceQuery & { projectId: string }): Promise<EntityEvidenceResult>;
	artifact?(input: EvidenceArtifactQuery & { projectId: string }): Promise<EvidenceArtifactResult>;
	history?(input: EntityQuery & { projectId: string; page: number; branch?: string }): Promise<{
		entries: HistoryEvent[];
		complete: boolean;
		nextPage: number | null;
	}>;
	available?(): Promise<boolean>;
	listProjects(): Promise<DesktopProject[]>;
	entity(input: EntityQuery & { projectId: string }): Promise<EntityDetail>;
	source(input: SourceQuery & { projectId: string }): Promise<SourceFile>;
	image(input: ImageQuery & { projectId: string }): Promise<Uint8Array>;
	messages(input: ThreadQuery & { projectId: string }): Promise<ThreadMessage[]>;
	snapshot(input: {
		projectId: string;
		branch: string | null;
		commit: string | null;
	}): Promise<ProjectSnapshot>;
	capabilities(projectId: string): Promise<ProjectCapabilities>;
	addComment(input: AddCommentInput): Promise<CommittedThread>;
}
export interface NativeHostedStatus {
	configured: boolean;
	state: 'signed-out' | 'pending' | 'signed-in';
	actor?: { id: string; name: string; email: string };
	handoff?: {
		userCode: string;
		verificationUrl: string;
		expiresAt: string;
		interval: number;
	};
}

/** Identity shared by app and game project snapshots. */
export interface ProjectIdentity {
	name: string;
	root: string;
	id?: string;
	kind?: 'app' | 'game' | 'local' | 'shared';
	dimension?: '2d' | '3d';
}
