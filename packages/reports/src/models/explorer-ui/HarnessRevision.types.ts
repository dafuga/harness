import type { ProjectDependencies } from '../../../../../src/services/explorer-ui/revision-detail-service/projectDependencies.types';
import type { ModuleCatalog } from '../../../../../src/services/module-system/moduleDefinition.types';
import type { PlatformCatalog } from '../../../../../src/core/explorer-ui/Platform.types';
import type { TranslationCatalog } from '../../../../../src/core/explorer-ui/Translation.types';
import type { RegressionView } from '../../../../../src/core/regressionTypes';
import type {
	HarnessUnit,
	HarnessScenario,
	HarnessRecord,
	HarnessExplanation
} from './Harness.types';

export interface HarnessRevision {
	modules?: ModuleCatalog;
	projectDependencies?: ProjectDependencies;
	platforms?: PlatformCatalog;
	translations?: TranslationCatalog;
	regressions?: RegressionView[];
	commit: string;
	/** Opaque whole-tree identity retained by entity projections, without a cache filename. */
	sourceTree?: string;
	registry: {
		available: boolean;
		gap?: string;
		units: HarnessUnit[];
		scenarios: HarnessScenario[];
		graph: { edges: Array<{ from: string; to: string; via: string }> };
	};
	comparison: {
		base: string | null;
		record: string;
		units: Record<'direct' | 'indirect' | 'added' | 'removed', string[]>;
		scenarios: string[];
		uncertain: Array<{ node: string; reason: string; detail: string }>;
	} | null;
	sourceImpact?: {
		base: string | null;
		expanded: boolean;
		units: Record<'direct' | 'indirect' | 'added' | 'removed', string[]>;
		scenarios: string[];
		uncertain: Array<{ node: string; reason: string; detail: string }>;
		changed: Array<{ path: string; status: string }>;
	} | null;
	side?: string | null;
	records: HarnessRecord[];
	explanations: HarnessExplanation[];
	rangeReasons?: number;
}
