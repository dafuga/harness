// @harness-uid u_k23ebybqw2
import type { CheckOutcome } from './check-run-service/CheckRunService.types';
import type { CoverageResult } from '../../../../utils/verification-evidence/scenarioCoverage.types';
export interface VerificationScenarioCoverage {
	own: CheckOutcome[];
	coverage: CoverageResult;
}
