// @harness-uid u_qhtw3ssuhz
import { componentManifestSchema } from '../../../../../src/core/unitTypes';
import { hubRead } from './hubSource';
import type { HubSourceContext } from './hubSource';
import { hubJson, hubFail } from './hubJson';
import { hubMetadata } from './hub-metadata/hubMetadata';
import type { ComponentManifest } from '../../../../../src/core/development-tooling/unitTypes.types';
export async function hubRecords(context: HubSourceContext): Promise<ComponentManifest[]> {
	await hubMetadata(context);
	const entries = context.entries.filter((e) => /^specification\/units\/[^/]+\.json$/.test(e.path));
	const units = await Promise.all(
		entries.map(async (e) => {
			const result = componentManifestSchema.safeParse(hubJson(await hubRead(context, e.path)));
			if (!result.success || e.path !== `specification/units/${result.data.id}.json`)
				return hubFail();
			return result.data;
		})
	);
	if (new Set(units.map((u) => u.id)).size !== units.length) return hubFail();
	return units;
}
