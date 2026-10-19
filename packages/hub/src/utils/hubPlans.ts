import { hubSchemas, hubPlanSchema } from './hubSchemas';
import { hubRead } from './hubSource';
import { hubJson, hubContractHash, hubFail } from './hubJson';
import type { HubSourceContext } from './hubSource';
import type { HubPlan } from './hubSchemas';
import { hubMetadata } from './hub-metadata/hubMetadata';

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

export { hubPlanRecord } from './hub-catalog/hubPlanRecord';
