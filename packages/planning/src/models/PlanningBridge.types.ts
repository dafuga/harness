/**
 * The operations of the planning facade, their inputs, and the envelope a bridge carries
 * them in. Inputs are plain data, so a main process can receive them over IPC and hand
 * them to `handlePlanningRequest`, which validates every field before anything is read
 * or written.
 */

import type { DesignOptionInput } from './DesignOption.types';
import type {
	AgentRef,
	ApprovalRecord,
	ArtifactReference,
	ChangeStatus,
	ChangeTarget,
	HostFileChange,
	DesignSource,
	DesignVersion,
	ImageBinding,
	MessageMode,
	NormalizedRegion,
	PlanAuthor,
	PlanCategory,
	PlanContract,
	PlanDetail,
	PlanSummary,
	PlanThread,
	PlanViewport,
	Sha256,
	ThreadMessage
} from './Planning.types';
import type {
	BranchInfo,
	CommitInfo,
	Committed,
	EntityHistory,
	ImageContent,
	PlanningFailure,
	ProjectSnapshot
} from './PlanningView.types';

/** A branch, tag or commit id. Left out, the checked-out commit is read. */
export interface RevisionInput {
	revision?: string;
}

export interface ListCommitsInput extends RevisionInput {
	/** 1 to 500; 50 when left out. */
	limit?: number;
}

export interface CreatePlanInput {
	/** Existing canonical manifest identity; omitted for a new draft identity. */
	unitId?: string;
	category: PlanCategory;
	/** Lowercase kebab case, at most 64 characters. */
	slug: string;
	title: string;
	goal: string;
	contract: PlanContract;
	author: PlanAuthor;
}

export interface DesignImageInput {
	/** Lowercase kebab case, such as `default` or `empty`. */
	state: string;
	viewport: PlanViewport;
	/** A complete PNG. It is checked again here, whatever the caller checked. */
	bytes: Uint8Array;
}

export interface AddDesignInput {
	unitId: string;
	prompt: string;
	generator: AgentRef;
	/** The images of a single design; with options, left out or exactly the union of theirs. */
	images?: DesignImageInput[];
	/** 1 to 10 separately generated alternatives of a visual design, saved as one version. */
	options?: DesignOptionInput[];
	/** Written behaviour or examples; a headless unit may have this instead of images. */
	notes?: string;
	/** A revised proposed contract. Left out, the version keeps the current one. */
	contract?: PlanContract;
	/** The source revision the design was made against; the checked-out commit otherwise. */
	baseRevision?: string;
	/** Required when the version revises an earlier image. */
	revises?: DesignSource;
	/** Refuse unless this is still the latest version (`null`: there is none yet). */
	expectedLatest?: string | null;
}

export interface ChangeDraft {
	target: ChangeTarget;
	status: ChangeStatus;
	changedPaths?: string[];
	hostChanges?: HostFileChange[];
	error?: string | null;
}

export interface MessageDraft {
	author: PlanAuthor;
	mode: MessageMode;
	agent?: AgentRef | null;
	body: string;
	references?: ArtifactReference[];
	/** Required when `mode` is `change`, and only then. */
	change?: ChangeDraft;
}

export interface OpenThreadInput {
	unitId: string;
	version: string | null;
	file: string | null;
	/** Must equal the recorded hash of that image. */
	imageSha256: Sha256 | null;
	region: NormalizedRegion | null;
	/** Checked against the option holding the image when given; derived from it otherwise. */
	option?: string;
	title?: string;
	author: PlanAuthor;
	/** The revision the reviewer was looking at; the checked-out commit otherwise. */
	viewedRevision?: string;
	/** A first message, written in the same commit. */
	message?: MessageDraft;
}

export interface AppendMessageInput extends MessageDraft {
	unitId: string;
	threadId: string;
}

export interface ApproveDesignInput {
	unitId: string;
	/** Must be the latest version. */
	version: string;
	/** Required when that version has options: the one option approved. */
	option?: string;
	/** Every image of the version, or of its approved option, with its exact hash. */
	images: ImageBinding[];
	notesSha256?: Sha256 | null;
	contractHash: Sha256;
	reviewer: string;
}

export interface ReadImageInput extends RevisionInput {
	unitId: string;
	version: string;
	file: string;
	/** When given, the image is refused unless it has this hash. */
	sha256?: Sha256;
	/** When given, the image is refused unless it belongs to this option. */
	option?: string;
}

export interface ReadPlanInput extends RevisionInput {
	unitId: string;
}

export interface EntityHistoryInput extends RevisionInput {
	unitId: string;
	/** 1 to 500; 100 when left out. */
	limit?: number;
}

/** The facade. Reads take a revision; writes always go to the checked-out branch. */
export interface PlanningApi {
	snapshot(input?: RevisionInput): Promise<ProjectSnapshot>;
	listPlans(input?: RevisionInput): Promise<PlanSummary[]>;
	readPlan(input: ReadPlanInput): Promise<PlanDetail>;
	listBranches(): Promise<BranchInfo[]>;
	listCommits(input?: ListCommitsInput): Promise<CommitInfo[]>;
	createPlan(input: CreatePlanInput): Promise<Committed<PlanDetail>>;
	addDesign(input: AddDesignInput): Promise<Committed<DesignVersion>>;
	openThread(input: OpenThreadInput): Promise<Committed<PlanThread>>;
	appendMessage(input: AppendMessageInput): Promise<Committed<ThreadMessage>>;
	approveDesign(input: ApproveDesignInput): Promise<Committed<ApprovalRecord>>;
	readImage(input: ReadImageInput): Promise<ImageContent>;
	entityHistory(input: EntityHistoryInput): Promise<EntityHistory>;
}

export type PlanningOperation = keyof PlanningApi;

export type PlanningInput<K extends PlanningOperation> = Parameters<PlanningApi[K]>[0];
export type PlanningOutput<K extends PlanningOperation> = Awaited<ReturnType<PlanningApi[K]>>;

/** One request as it crosses a bridge. */
export type PlanningRequest = {
	[K in PlanningOperation]: { operation: K; input: PlanningInput<K> };
}[PlanningOperation];

/** A bridge never throws: it answers with a value or with a failure. */
export type PlanningResult<T> = { ok: true; value: T } | { ok: false; error: PlanningFailure };

/** The same operations as the facade, each answering with a `PlanningResult`. */
export type PlanningBridge = {
	[K in PlanningOperation]: (input: PlanningInput<K>) => Promise<PlanningResult<PlanningOutput<K>>>;
};
