import type { ImpactReport } from '../../../../core/development-tooling/impactTypes';
import type { VerifyConfig } from '../../../../core/verification-evidence/verifyTypes';
import type { ReasonReport } from '../../../../services/development-tooling/ExplanationService';
import type { RevisionSide } from '../../../development-tooling/loadRevisions';

export interface VerifyContext {
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
	impact: ImpactReport;
	config: VerifyConfig;
	testTimeoutMs?: number;
	env: Record<string, string | undefined>;
	/** Whether every change since the base is explained, directly or step by step. */
	explained: () => Promise<ReasonReport>;
}
