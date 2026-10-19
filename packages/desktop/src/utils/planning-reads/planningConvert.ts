import type { PlanDetail } from "../../../../planning/src/index";
import type { EntityContract } from "../../models/Desktop.types.ts";

export function planningConvert(plan: PlanDetail): EntityContract {
	return {
		inputs: plan.contract.inputs,
		outputs: plan.contract.outputs,
		errors: plan.contract.errors.map((name) => ({ name, type: 'error' })),
		hash: plan.contractHash
	};
}
