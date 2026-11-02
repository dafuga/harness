// @harness-uid u_d5oknerikb
export type { HostFileChange, ChangeTarget, ChangeRecord } from './HostFileChange.types';
import type { DesignOption } from './DesignOption.types';
export type { DesignOption, DesignOptionInput } from './DesignOption.types';
/** Git-stored planning artifacts are plain data; image bytes use structured clone. */

export type PlanCategory =
	| 'page'
	| 'shell'
	| 'layout'
	| 'component'
	| 'function'
	| 'config'
	| 'service';
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
	/** The option of the version that holds that image, when it has options. */
	option?: string;
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
	/** Separately generated alternatives; a single design has none. */
	options?: DesignOption[];
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
	/** The one option approved, when the version has options; no other option is. */
	option?: string;
	/** Derived: the commit that added the record. */
	commit: CommitId;
	/** Derived: it binds the latest version, its exact files and its contract. */
	current: boolean;
}
export type * from './PlanThread.types';
export type * from './PlanSummary.types';
