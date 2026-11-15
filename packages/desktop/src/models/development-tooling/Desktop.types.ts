// @harness-uid u_4egzpjwwgu
import type { ProjectIdentity } from '../projects-sessions/ProjectContext.types';
import type { ProjectCapabilities } from '../projects-sessions/ProjectContext.types';
import type { CacheProvenance } from '../projects-sessions/ProjectContext.types';
import type { categories } from './DesktopValues';
import type { CatalogEntity } from './DesktopEntity.types';
export type Category = (typeof categories)[number];

export type ProviderId = 'codex' | 'claude';

export type RunMode = 'plan' | 'change';

/**
 * `verified` and `failed` come from a verification record of the viewed commit. A plan is
 * `unverified` until such a record exists; a unit without one is `unknown`, never assumed.
 */
export type Verification = 'verified' | 'failed' | 'unverified' | 'unknown';

/** A rectangle on an image, each value a fraction of the image's width or height. */
export interface Region {
	x: number;
	y: number;
	width: number;
	height: number;
}

export interface ModelChoice {
	/** The identifier the CLI itself reported or accepts; passed back unchanged. */
	id: string;
	label: string;
	efforts: string[];
	defaultEffort: string | null;
	isDefault: boolean;
}

export interface ProviderState {
	id: ProviderId;
	label: string;
	available: boolean;
	/** Why the provider cannot be used, in words for the composer. */
	reason: string | null;
	version: string | null;
	imageGeneration: boolean;
	models: ModelChoice[];
}

export interface BranchInfo {
	name: string;
	tip: string;
	current: boolean;
}

export interface CommitInfo {
	hash: string;
	subject: string;
	authoredAt: string;
	committedAt?: string;
}

export interface Revision {
	branch: string;
	commit: string;
	tip: string;
	atTip: boolean;
}

export interface ApprovalInfo {
	id: string;
	version: string;
	imageHashes: string[];
	contractHash: string;
	approvedAt: string;
	/** False once a later version exists: that version needs its own approval. */
	current: boolean;
	/** The one design option approved, when the version has options. */
	option?: string;
}

export interface ThreadInfo {
	id: string;
	pin: number;
	version: string | null;
	imageSha256: string | null;
	state: string | null;
	viewport: string | null;
	region: Region | null;
	/** The design option of the anchored image, when its version has options. */
	option?: string;
	messageCount: number;
}

export interface ThreadMessage {
	id: string;
	at: string;
	author: 'user' | 'agent' | 'system';
	actorId?: string;
	authorName?: string;
	text: string;
	mode: RunMode | null;
	provider: ProviderId | null;
	model: string | null;
	/** The design version this message produced or refers to. */
	version: string | null;
	imageSha256: string | null;
}

export interface ProjectSnapshot {
	project: ProjectIdentity;
	capabilities?: ProjectCapabilities;
	cache?: CacheProvenance;
	revision: Revision;
	branches: BranchInfo[];
	commits: CommitInfo[];
	entities: CatalogEntity[];
	/** True only at the tip of the checked-out branch: history is read-only. */
	writable: boolean;
}

export interface SourceChange {
	path: string;
	change: 'added' | 'modified' | 'deleted';
}
export {
	type DesignImage,
	type DesignOptionInfo,
	type DesignRevision,
	type DesignVersion,
	categories
} from './DesktopValues';
export type * from './DesktopEntity.types';
