// @harness-uid u_33ugo6gwgh
import type { ImpactReport } from '../../../../../core/development-tooling/impactTypes';
import type {
	ScenarioResult,
	VerificationRecord,
	VerificationProfile
} from '../../../../../core/verification-evidence/verificationTypes';
import type { VerificationStoreRepository } from '../../../../../repositories/verification-evidence/VerificationStoreRepository';
import type { ReasonReport } from '../../../../../services/development-tooling/ExplanationService';
import type { RevisionSide } from '../../../../development-tooling/loadRevisions';
import type { Executed } from '../SnapshotRunService';
import type { VerificationSourceHashes } from './sealRecord.types';
import type { ScenarioJudgement } from '../../../../../utils/verification-evidence/scenarioCoverage.types';

export interface AssemblyContext {
	requirePerformance?: boolean;
	root: string;
	commit: string;
	tree: string;
	baseCommit: string | null;
	baseRecord?: string;
	requestedBase: string | null;
	base: RevisionSide;
	head: RevisionSide;
	sourceHashes?: VerificationSourceHashes;
	impact: ImpactReport;
	profile: VerificationProfile;
	store: VerificationStoreRepository;
	/** Whether every change since the base is explained, directly or step by step. */
	explained: () => Promise<ReasonReport>;
}

export interface AssemblyInput {
	startedAt: string;
	executed: Executed;
	scenarios: ScenarioJudgement[];
	referenced: ScenarioResult[];
	lite?: Omit<NonNullable<VerificationRecord['lite']>, 'status' | 'pendingEvidence'>;
}
