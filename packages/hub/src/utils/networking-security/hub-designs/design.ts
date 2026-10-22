import { hubRead } from '../../development-tooling/hubSource';
import type { HubSourceContext } from '../../development-tooling/hubSource';
import { hubJson, hubContractHash, hubFail } from '../../development-tooling/hubJson';
import { hubSchemas, hubDesignSchema } from '../../development-tooling/hubSchemas';
import { hubOptions } from './hubOptions';
import type { HubPlan, HubDesign } from '../../development-tooling/hubSchemas';

export async function design(
	context: HubSourceContext,
	plan: HubPlan,
	path: string
): Promise<HubDesign> {
	const value = hubSchemas(hubDesignSchema, hubJson(await hubRead(context, path)));
	if (
		value.unitId !== plan.unitId ||
		path !== `${plan.path}/designs/${value.version}/design.json` ||
		(await hubContractHash(value.contract)) !== value.contractHash
	)
		return hubFail();
	return hubOptions(value);
}
