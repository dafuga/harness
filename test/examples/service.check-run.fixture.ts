import type { PlannedCheck } from '../../src/utils/verification-evidence/verifyPlan';

export function plannedCheck(overrides: Partial<PlannedCheck> & { command: string }): PlannedCheck {
	return {
		id: 'src/services/CheckRunService.test.ts',
		name: 'CheckRunService',
		kind: 'unit',
		runner: 'command',
		target: 'module',
		cwd: '.',
		timeoutMs: 30_000,
		...overrides
	};
}
