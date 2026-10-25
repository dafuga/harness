import type { RevisionRegistry } from '../../../src/utils/revisionRegistry';
import type { PreparedModuleData } from '../../../src/services/git-source-history/ModuleDataService.types';
export type Unit = RevisionRegistry['units'][number];

export interface Detail {
	registry: RevisionRegistry;
	moduleData?: PreparedModuleData;
	records: Array<{ status: string; failures: string[] }>;
}
