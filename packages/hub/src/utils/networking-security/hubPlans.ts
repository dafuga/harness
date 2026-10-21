import { hubSchemas, hubPlanSchema } from '../development-tooling/hubSchemas';
import { hubRead } from '../development-tooling/hubSource';
import { hubJson, hubContractHash, hubFail } from '../development-tooling/hubJson';
import type { HubSourceContext } from '../development-tooling/hubSource';
import type { HubPlan } from '../development-tooling/hubSchemas';
import { hubMetadata } from '../development-tooling/hub-metadata/hubMetadata';

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
