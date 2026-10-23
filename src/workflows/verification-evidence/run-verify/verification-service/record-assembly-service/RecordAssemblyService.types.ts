import type { RevisionSide } from '../../../../loadRevisions';
import type { ImpactReport } from '../../../../../core/impactTypes';
import type { VerificationProfile } from '../../../../../core/verificationTypes';
import type { ScenarioResult } from '../../../../../core/verificationTypes';
import type { VerificationStoreRepository } from '../../../../../repositories/VerificationStoreRepository';
import type { ReasonReport } from '../../../../../services/ExplanationService';
import type { Executed } from '../SnapshotRunService';

export interface AssemblyContext {
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
