import type { verifyPlanReport } from '../../src/workflows/verification-evidence/run-verify/verification-service/verifyPlanReport';
import type { VerifyPlanReport } from '../../src/workflows/verification-evidence/run-verify/verification-service/verifyPlanReport.types';

export type PlanInput = Parameters<typeof verifyPlanReport>[0];

export type Source = VerifyPlanReport['source'];
