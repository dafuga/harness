import { hubSchemas } from '../../development-tooling/hubSchemas';
import { hubRead } from '../../development-tooling/hubSource';
import { hubJson, hubContractHash } from '../../development-tooling/hubJson';
import { hubDesigns } from './hubDesigns';
import type { HubSourceContext } from '../../development-tooling/hubSource';
import type { HubPlan } from '../../development-tooling/hubSchemas';
import type { PlanRecord } from '../../../../../desktop/src/models/PlanningPort.types';
import { z } from 'zod';
import { hubContractSchema } from '../../development-tooling/hubSchemas';

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
