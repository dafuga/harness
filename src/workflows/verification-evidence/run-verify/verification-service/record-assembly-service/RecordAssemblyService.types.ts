import type { ImpactReport } from '../../../../../core/development-tooling/impactTypes';
import type {
	ScenarioResult,
	VerificationProfile
} from '../../../../../core/verification-evidence/verificationTypes';
import type { VerificationStoreRepository } from '../../../../../repositories/verification-evidence/VerificationStoreRepository';
import type { ReasonReport } from '../../../../../services/ExplanationService';
import type { RevisionSide } from '../../../../loadRevisions';
import type { Executed } from '../SnapshotRunService';

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
	impact: ImpactReport;
	profile: VerificationProfile;
	store: VerificationStoreRepository;
	/** Whether every change since the base is explained, directly or step by step. */
	explained: () => Promise<ReasonReport>;
}

export interface AssemblyInput {
	startedAt: string;
	executed: Executed;
	scenarios: Array<{ result: ScenarioResult; failures: string[] }>;
	referenced: ScenarioResult[];
}
