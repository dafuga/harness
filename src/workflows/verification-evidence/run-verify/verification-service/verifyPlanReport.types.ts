// @harness-uid u_v9gz1knx6a
import type { PlannedCheck } from '../../../../utils/verification-evidence/verifyPlan';

export interface VerifyPlanReport {
	mode: 'report-only';
	executedChecks: 0;
	note: 'Candidates describe matching command shapes; checks remain uncombined and are not executed.';
	sideEffects: 'Does not restore evidence or run planned checks; impact analysis may invoke the selected local kernel.';
	source: {
		commit: string;
		base: string | null;
		requestedBase: string | null;
		runtime: string;
		scope: 'full' | 'entity';
		entity?: string;
		baseResolution: 'local-cache' | 'empty-conservative' | 'entity';
		selectionNote: string;
	};
	plannedChecks: number;
	candidateGroups: number;
	candidateChecks: number;
	singletons: number;
	ineligible: number;
	checks: Array<{
		id: string;
		path: string;
		runner: PlannedCheck['runner'];
		cwd: string;
		command: string;
		timeoutMs: number;
		decision: 'candidate' | 'singleton' | 'ineligible';
		groupId?: string;
		reason?: string;
	}>;
	candidates: Array<{
		id: string;
		runner: PlannedCheck['runner'];
		cwd: string;
		commandTemplate: string;
		timeoutMs: number;
		checks: Array<{ id: string; path: string }>;
	}>;
}

export interface NormalizedCheck {
	check: PlannedCheck;
	template: string;
}
