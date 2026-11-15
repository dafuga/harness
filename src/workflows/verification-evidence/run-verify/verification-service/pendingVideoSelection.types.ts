// @harness-uid u_k23ebybqw2
import type { PlannedCheck } from '../../../../utils/verification-evidence/verifyPlan';
import type { ScenarioResult } from '../../../../core/verification-evidence/verificationTypes';
import type { ScenarioManifest } from '../../../../core/development-tooling/unitTypes';
export interface PendingVideoSelection {
	plan: PlannedCheck[];
	referenced: ScenarioResult[];
	rerun: ScenarioManifest[];
}
