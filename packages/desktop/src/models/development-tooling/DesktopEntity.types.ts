// @harness-uid u_ppc5mrepmj
import type { ComponentManifest } from '../../../../../src/lib/contracts';
import type { UnitDocumentation } from '../../../../../src/utils/unit-documentation/unitDocumentation';
import type { DesignVersion } from '../DesignVersion.types';
import type { Category, ThreadInfo, Verification } from './Desktop.types';

export interface ContractField {
	name: string;
	type: string;
	required?: boolean;
	default?: unknown;
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
