import { hubModuleData } from '../../development-tooling/hubModuleData';
import type { HubSourceContext } from '../../development-tooling/hubSource';

/** Evidence reads share the same committed module graph as every other hosted resource. */
export async function hubEvidenceRegistry(context: HubSourceContext) {
	return (await hubModuleData(context, true)).registry;
}
