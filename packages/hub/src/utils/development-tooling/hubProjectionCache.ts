import { hubModuleData, hubRequiresModuleData } from './hubModuleData';
import { cacheKey, readCache, writeCache } from 'collaboration';
import type { HubSourceContext } from './hubSource';
import { hubHash } from './hubJson';

/** The caller must resolve current GitHub refs and permissions before consulting this cache. */
export async function hubProjectionCache<T>(
	context: HubSourceContext,
	projection: { profile: string; accept: (value: unknown) => T },
	load: () => Promise<T>
): Promise<T> {
	const metadata = hubRequiresModuleData(context) ? await hubModuleData(context, true) : undefined;
	const profile = metadata
		? `${projection.profile}\nmodule-data:${metadata.digest}`
		: projection.profile;
	const identity = {
		...context.identity,
		artifactHash: null,
		profile: 'projection:' + (await hubHash(new TextEncoder().encode(profile)))
	};
	const cached = await readCache(context.cache, identity);
	if (cached) {
		try {
			return projection.accept(
				JSON.parse(new TextDecoder('utf-8', { fatal: true }).decode(cached))
			);
		} catch {
			await context.cache.delete(await cacheKey(identity));
		}
	}
	const value = projection.accept(await load());
	await writeCache(context.cache, identity, new TextEncoder().encode(JSON.stringify(value)));
	return value;
}
