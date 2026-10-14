import { hubSchemas, hubPlanSchema } from './hubSchemas';
import { hubRead } from './hubSource';
import { hubJson, hubContractHash, hubFail } from './hubJson';
import { hubDesigns } from './hubDesigns';
import type { HubSourceContext } from './hubSource';
import type { HubPlan } from './hubSchemas';
import type { PlanRecord } from '../../../desktop/src/models/PlanningPort.types';
import { hubMetadata } from './hubMetadata';
export async function hubPlans(context: HubSourceContext): Promise<HubPlan[]> {
	await hubMetadata(context);
	const paths = context.entries.filter((e) =>
		/^src\/(pages|shells|components|functions|configs|services)\/[^/]+\/plan.json$/.test(e.path)
	);
	const plans = await Promise.all(
		paths.map(async (e) => {
			const p = hubSchemas(hubPlanSchema, hubJson(await hubRead(context, e.path)));
			if (
				e.path !== p.path + '/plan.json' ||
				p.path !== `src/${p.category}s/${p.slug}` ||
				(await hubContractHash(p.contract)) !== p.contractHash
			)
				return hubFail();
			return p;
		})
	);
	if (new Set(plans.map((p) => p.unitId)).size !== plans.length) return hubFail();
	return plans;
}
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
import { z } from 'zod';
import { hubContractSchema } from './hubSchemas';
const hubDesignSchemaForContract = z
	.object({ contract: hubContractSchema })
	.transform((value) => value.contract);

function lifecycle(latest: PlanRecord['versions'][number] | undefined) {
	if (latest?.approval?.current) return 'approved';
	return latest ? 'review' : 'draft';
}
