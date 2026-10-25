import { hubModuleData } from './hubModuleData';
import type { HubSourceContext } from './hubSource';

/** Hosted resources always use the validated committed declarations. */
export async function hubRecords(context: HubSourceContext) {
	return (await hubModuleData(context, true)).declarations;
}
