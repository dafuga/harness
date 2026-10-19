import { hubRead } from "../hubSource";
import type { HubSourceContext } from "../hubSource";
import { hubJson, hubContractHash, hubFail } from "../hubJson";
import { hubSchemas, hubDesignSchema } from "../hubSchemas";
import { hubOptions } from "./hubOptions";
import type { HubPlan, HubDesign } from "../hubSchemas";

export async function design(context: HubSourceContext, plan: HubPlan, path: string): Promise<HubDesign> {
	const value = hubSchemas(hubDesignSchema, hubJson(await hubRead(context, path)));
	if (
		value.unitId !== plan.unitId ||
		path !== `${plan.path}/designs/${value.version}/design.json` ||
		(await hubContractHash(value.contract)) !== value.contractHash
	)
		return hubFail();
	return hubOptions(value);
}
