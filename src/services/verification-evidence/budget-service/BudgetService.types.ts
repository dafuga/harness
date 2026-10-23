import type { BudgetBaseline } from '../../../utils/verification-evidence/budgetFindings';
import type { ComponentManifest } from '../../../core/development-tooling/unitTypes';
import type { BudgetFinding } from '../../../core/verification-evidence/verificationTypes';

export interface UnitBaseline extends BudgetBaseline {
	/** Retired predecessor whose frozen limits this unit continues. */
	inheritedFrom?: string;
}

export interface BudgetSubject {
	manifest: ComponentManifest;
	/** True when the unit's own source changed, so its size and complexity are judged. */
	checkSize: boolean;
}

export interface BudgetReport {
	findings: BudgetFinding[];
	failures: string[];
}
