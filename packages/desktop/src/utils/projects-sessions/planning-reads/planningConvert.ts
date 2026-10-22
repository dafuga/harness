import type { PlanDetail } from '../../../../../planning/src/lib/planning/index';
import type { EntityContract } from '../../../models/development-tooling/Desktop.types';

export function planningConvert(plan: PlanDetail): EntityContract {
	return {
		inputs: plan.contract.inputs,
		outputs: plan.contract.outputs,
		errors: plan.contract.errors.map((name) => ({ name, type: 'error' })),
		hash: plan.contractHash
	};
}
