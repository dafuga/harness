import type { ProjectCapabilities, CacheProvenance } from '../ProjectContext.types';
import type { ProjectIdentity } from '../ProjectContext.types';
import type { DesignVersion } from '../DesignVersion.types';
import type { ComponentManifest } from '../../../../../src/lib/contracts';
import type { UnitDocumentation } from '../../../../../src/utils/unit-documentation/unitDocumentation';
export type {
	DesignImage,
	DesignOptionInfo,
	DesignRevision,
	DesignVersion
} from '../DesignVersion.types';
/**
 * What the Electron main process tells the renderer about a project. Every value here is
 * serializable: it crosses the preload bridge by structured clone.
 */
export const categories = [
	'pages',
	'shells',
	'components',
	'functions',
	'configs',
	'services',
	'models'
] as const;
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

export interface ContractField {
	name: string;
	type: string;
	/** What this field means to someone reviewing the behaviour. */
	description?: string;
}

export interface EntityContract {
	inputs: ContractField[];
	outputs: ContractField[];
	errors: ContractField[];
	/** SHA-256 of the contract an approval binds; null when the entity has no contract yet. */
	hash: string | null;
}

export interface Relationship {
	id: string;
	title: string;
	category: Category | null;
	direction: 'uses' | 'used-by';
	hasPlan: boolean;
	verification: Verification;
}

export interface HistoryEvent {
	id: string;
	at: string;
	kind: 'commit' | 'design' | 'approval' | 'thread' | 'reason' | 'change';
	title: string;
	detail: string;
	commit: string | null;
	version: string | null;
}

export interface DesignThumbnail {
	source?: 'design';
	version: string;
	sha256: string;
	state: string;
	viewport: string;
}
export type Thumbnail =
	| DesignThumbnail
	| ({ source: 'recorded' } & Partial<NonNullable<ComponentManifest['preview']>>);

export interface CatalogEntity {
	helperContracts?: ComponentManifest['helperContracts'];
	id: string;
	category: Category;
	kind: string;
	title: string;
	summary: string;
	changed: boolean;
	/** A draft identity of the planning index: no implementation and no registry entry. */
	planned: boolean;
	/** A design proposal exists and is not implemented: the entity carries the Plan badge. */
	hasPlan: boolean;
	lifecycle: string | null;
	verification: Verification;
	verificationNote: string;
	latestVersion: string | null;
	approvedVersion: string | null;
	threadCount: number;
	thumbnail: Thumbnail | null;
}

export interface Measure {
	available: boolean;
	text: string;
}

export interface EntityDetail extends CatalogEntity {
	documentation?: UnitDocumentation;
	historyCoverage?: { complete: boolean; nextPage: number | null; loadedPages: number };
	contract: EntityContract;
	relationships: Relationship[];
	versions: DesignVersion[];
	threads: ThreadInfo[];
	history: HistoryEvent[];
	/** Source paths the unit owns; shown only under Details, then Source. */
	sources: string[];
	size: Measure;
	performance: Measure;
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
