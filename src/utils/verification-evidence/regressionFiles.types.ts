import type { RegressionRecord } from '../../core/verification-evidence/regressionTypes';

export interface FrozenRegressionInputs {
	inputs: RegressionRecord['inputs'];
	expectations: NonNullable<RegressionRecord['expectations']>;
}
export interface UnitTestEdit {
	allowed: boolean;
	strengthened: boolean;
}
