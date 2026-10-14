import type { ChangeRecord } from './HostFileChange.types';
export type { HostFileChange, ChangeTarget, ChangeRecord } from './HostFileChange.types';
/**
 * Planning artifacts as they are stored in Git and returned by the facade.
 * Every type here is plain data: it survives JSON and structured clone unchanged,
 * except `ImageContent.bytes`, which needs structured clone (Electron IPC).
 */

export type PlanCategory = 'page' | 'shell' | 'component' | 'function' | 'config' | 'service';
/** Pages and components use the three screen viewports; headless units use `diagram`. */
export type PlanViewport = 'desktop' | 'tablet' | 'mobile' | 'diagram';
/** Derived, never stored: no version, latest version unapproved, latest version approved. */
export type PlanLifecycle = 'draft' | 'review' | 'approved';
export type MessageMode = 'plan' | 'change';
export type ChangeStatus = 'requested' | 'running' | 'completed' | 'failed' | 'cancelled';

/** 64 lowercase hexadecimal characters. */
export type Sha256 = string;
/** A full 40 character Git commit id. */
export type CommitId = string;
/** ISO 8601 in UTC, as `Date.prototype.toISOString` writes it. */
export type IsoTime = string;

export interface ContractField {
	name: string;
	type: string;
}

/** The proposed contract of a plan. Its canonical JSON is what `contractHash` covers. */
export interface PlanContract {
	responsibility: string;
	inputs: ContractField[];
	outputs: ContractField[];
	errors: string[];
	states: string[];
	viewports: PlanViewport[];
}

/** A rectangle in fractions of the image, origin top left, rounded to six decimals. */
export interface NormalizedRegion {
	x: number;
	y: number;
	width: number;
	height: number;
}

export interface PlanAuthor {
	kind: 'person' | 'agent';
	name: string;
}

/** The CLI and model that produced something, as the caller really ran them. */
export interface AgentRef {
	provider: string;
	model: string;
}

export interface ImageBinding {
	file: string;
	sha256: Sha256;
}

export interface DesignImage extends ImageBinding {
	state: string;
	viewport: PlanViewport;
	bytes: number;
	width: number;
	height: number;
	mediaType: 'image/png';
	/** Derived: whether this checkout holds the Git LFS object. */
	content: 'present' | 'missing';
}

export interface StoredFile {
	file: string;
	sha256: Sha256;
}

/** The image and rectangle a revision was generated from. */
export interface DesignSource {
	version: string;
	file: string;
	imageSha256: Sha256;
	region: NormalizedRegion | null;
	threadId: string | null;
}

export interface DesignVersion {
	unitId: string;
	/** `v001`, `v002`, … in the order they were added. */
	version: string;
	createdAt: IsoTime;
	generator: AgentRef;
	prompt: StoredFile;
	/** Written behaviour or examples of a headless unit; `null` for a purely visual version. */
	notes: StoredFile | null;
	/** The source revision the design was made against. */
	baseRevision: CommitId;
	images: DesignImage[];
	contract: PlanContract;
	contractHash: Sha256;
	revises: DesignSource | null;
	/** Derived from history: the commit that added this version. Never stored in the version. */
	commit: CommitId;
}

export interface ApprovalRecord {
	id: string;
	unitId: string;
	version: string;
	images: ImageBinding[];
	notesSha256: Sha256 | null;
	contractHash: Sha256;
	reviewer: string;
	approvedAt: IsoTime;
	/** Derived: the commit that added the record. */
	commit: CommitId;
	/** Derived: it binds the latest version, its exact files and its contract. */
	current: boolean;
}

export interface ThreadAnchor {
	version: string;
	file: string;
	imageSha256: Sha256;
	state: string;
	viewport: PlanViewport;
	/** `null` anchors the whole image. */
	region: NormalizedRegion | null;
}

export type ArtifactReference =
	| { kind: 'image'; version: string; file: string; sha256: Sha256 }
	| { kind: 'notes'; version: string; sha256: Sha256 }
	| { kind: 'approval'; approvalId: string };

export interface ThreadMessage {
	id: string;
	unitId: string;
	threadId: string;
	/** 1 for the first message of the thread. */
	sequence: number;
	/** SHA-256 of the previous line, or of `thread.json` for the first message. */
	previous: Sha256;
	at: IsoTime;
	author: PlanAuthor;
	mode: MessageMode;
	agent: AgentRef | null;
	body: string;
	references: ArtifactReference[];
	change: ChangeRecord | null;
}

export interface PlanThread {
	id: string;
	unitId: string;
	/** The number shown on the image, counted per unit. */
	pin: number;
	title: string;
	anchor: ThreadAnchor | null;
	/** The revision the reviewer was looking at. */
	viewedRevision: CommitId;
	createdAt: IsoTime;
	createdBy: PlanAuthor;
	/** Derived: the commit that opened the thread. */
	commit: CommitId;
	messages: ThreadMessage[];
}

export interface PlanSummary {
	/** Existing canonical identity, or `<category>.<slug>` for a new draft. */
	unitId: string;
	category: PlanCategory;
	slug: string;
	title: string;
	goal: string;
	createdAt: IsoTime;
	createdBy: PlanAuthor;
	baseRevision: CommitId;
	/** The unit folder, relative to the repository root. */
	path: string;
	/** Derived: the commit that created the plan. */
	commit: CommitId;
	lifecycle: PlanLifecycle;
	/** Derived: `specification/units/<unitId>.json` exists at this revision. */
	registered: boolean;
	/** Planning never verifies anything at runtime and never says that it did. */
	verified: false;
	latestVersion: string | null;
	/** The contract of the latest version, or of the plan while it has none. */
	contract: PlanContract;
	contractHash: Sha256;
	/** The approval that is current, if any. */
	approval: ApprovalRecord | null;
	versionCount: number;
	threadCount: number;
}

export interface PlanDetail extends PlanSummary {
	versions: DesignVersion[];
	/** Every approval ever recorded, oldest first; superseded ones stay. */
	approvals: ApprovalRecord[];
	threads: PlanThread[];
}
