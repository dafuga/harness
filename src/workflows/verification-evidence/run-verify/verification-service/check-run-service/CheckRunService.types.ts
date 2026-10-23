import type { VerificationRecord } from '../../../../../core/verification-evidence/verificationTypes';
import type { Gathered } from '../../../../../utils/verification-evidence/gatherCaptures';
import type { PlannedCheck } from '../../../../../utils/verification-evidence/verifyPlan';

export interface RunContext {
	/** Clean export of the commit; every check runs inside it. */
	snapshot: string;
	/** Scratch directory of this run; evidence and logs are written beneath it. */
	directory: string;
	commit: string;
	tree: string;
	profile: string;
	env: Record<string, string | undefined>;
}

export interface CheckOutcome {
	check: PlannedCheck;
	passed: boolean;
	entry: VerificationRecord['tests'][number];
	gathered: Gathered[];
	failures: string[];
}
