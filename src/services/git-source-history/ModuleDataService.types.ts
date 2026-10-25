import type { ModuleReview } from '../../repositories/git-source-history/ModuleDataReviewRepository.types';
import type { preparedModuleData } from './module-data-service/preparedModuleData';
import type { ComponentVersion } from '../../utils/development-tooling/componentVersion';
import type { ComponentManifest } from '../../core/development-tooling/unitTypes';
import type { SourceGraph } from '../../core/development-tooling/sourceTypes';
import type { RevisionRegistry } from '../../utils/revisionRegistry';
export interface ModuleIssue {
	kind?: 'metadata' | 'evidence';
	field: string;
	message: string;
	repair: string;
}
export interface ModuleValidation {
	id: string;
	kind: string;
	category: string | null;
	issues: ModuleIssue[];
}
export interface ModuleRelationships {
	pages: string[];
	layouts: string[];
	components: string[];
	functions: string[];
	configs: string[];
	services: string[];
	types: string[];
	apis: string[];
	models: string[];
	usedBy: string[];
	support: string[];
}
export interface ModuleData {
	schemaVersion: 1;
	producer: string;
	commit: string;
	tree: string;
	inputs: { notes: string | null; evidence: string | null };
	reviews?: ModuleReview[];
	declarations: ComponentManifest[];
	versions: Record<string, ComponentVersion>;
	sourceGraph: SourceGraph;
	sourceIssues: string[];
	references: SourceGraph['uncertain'];
	registry: RevisionRegistry;
	relationships: Record<string, ModuleRelationships>;
	modules: ModuleValidation[];
	issues: string[];
	digest: string;
}
export interface ValidateOptions {
	module?: string;
	type?: string;
	commit?: string;
	history?: boolean;
	all?: boolean;
	write?: boolean;
	refresh?: boolean;
	review?: string;
	json?: boolean;
	sync?: string;
}
export interface ValidationReport {
	commit: string;
	valid: boolean;
	complete: boolean;
	evidenceGaps: number;
	committed: boolean;
	cached: boolean;
	modules: ModuleValidation[];
	issues: string[];
	metadataCommit?: string;
	digest: string;
}

export type PreparedModuleData = Awaited<ReturnType<typeof preparedModuleData>>;

export interface HistoryValidationReport {
	commit: string;
	valid: boolean;
	modules: ModuleValidation[];
	revisions: Array<
		Omit<ValidationReport, 'modules'> & {
			moduleCount: number;
			missingModules: number;
			issueCount: number;
		}
	>;
}
