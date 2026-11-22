// @harness-uid u_k23ebybqw2
import type { ImpactReport } from '../../../../core/development-tooling/impactTypes';
import type {
	VerificationMode,
	VerifyConfig
} from '../../../../core/verification-evidence/verifyTypes';
import type { ReasonReport } from '../../../../services/development-tooling/ExplanationService';
import type { RevisionSide } from '../../../development-tooling/loadRevisions';
import type { VerificationSourceHashes } from './record-assembly-service/sealRecord.types';
import type { PlannedCheck } from '../../../../utils/verification-evidence/verifyPlan';

export interface ProfiledPlan {
	plan: PlannedCheck[];
	pendingChecks: PlannedCheck[];
}

export interface VerifyContext {
	verificationProfile?: VerificationMode;
	requirePerformance?: boolean;
	root: string;
	commit: string;
	tree: string;
	/** The proven revision everything is judged against, or null when nothing is proven. */
	baseCommit: string | null;
	/** The passing record that proves the base; inherited evidence comes from it alone. */
	baseRecord?: string;
	/** The base that was asked for; it differs when that revision has no passing record. */
	requestedBase: string | null;
	base: RevisionSide;
	head: RevisionSide;
	sourceHashes?: VerificationSourceHashes;
	impact: ImpactReport;
	config: VerifyConfig;
	testTimeoutMs?: number;
	/** One entity to verify alone: only its scenario states run, and the record is partial. */
	entity?: string;
	env: Record<string, string | undefined>;
	/** Whether every change since the base is explained, directly or step by step. */
	explained: () => Promise<ReasonReport>;
}
