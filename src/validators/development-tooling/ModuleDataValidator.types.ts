import type { RevisionDetail } from '../../services/explorer-ui/revision-detail-service/RevisionDetailService';
import type { ModuleValidation } from '../../services/git-source-history/ModuleDataService.types';
export interface ModuleDataValidatorResult {
	modules: ModuleValidation[];
	issues: string[];
}

export type ModuleValidationInput = Pick<
	RevisionDetail,
	'commit' | 'registry' | 'records' | 'regressions'
>;
