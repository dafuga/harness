import { hubSchemas } from "../hubSchemas";
import { hubRead } from "../hubSource";
import { hubJson, hubContractHash } from "../hubJson";
import { hubDesigns } from "./hubDesigns";
import type { HubSourceContext } from "../hubSource";
import type { HubPlan } from "../hubSchemas";
import type { PlanRecord } from "../../../../desktop/src/models/PlanningPort.types.ts";
import { z } from "zod";
import { hubContractSchema } from "../hubSchemas";

export async function hubPlanRecord(context: HubSourceContext, plan: HubPlan): Promise<PlanRecord> {
	const versions = await hubDesigns(context, plan),
		latest = versions.at(-1);
	const contract = latest
		? {
				...plan.contract,
				...hubSchemas(
					hubDesignSchemaForContract,
					hubJson(await hubRead(context, `${plan.path}/designs/${latest.version}/design.json`))
				)
			}
		: plan.contract;
	return {
		id: plan.unitId,
		path: plan.path,
		category: (plan.category + 's') as PlanRecord['category'],
		title: plan.title,
		goal: plan.goal,
		lifecycle: lifecycle(latest),
		versions,
		threads: [],
		contract: {
			inputs: contract.inputs,
			outputs: contract.outputs,
			errors: contract.errors.map((name) => ({ name, type: 'error' })),
			hash: await hubContractHash(contract)
		}
	};
}

const hubDesignSchemaForContract = z
	.object({ contract: hubContractSchema })
	.transform((value) => value.contract);

function lifecycle(latest: PlanRecord['versions'][number] | undefined) {
	if (latest?.approval?.current) return 'approved';
	return latest ? 'review' : 'draft';
}
