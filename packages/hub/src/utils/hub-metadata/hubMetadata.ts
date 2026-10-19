import { cacheKey, readCache, writeCache } from "collaboration";
import type { HubSourceContext } from "../hubSource";
import { hubMetadataPaths } from "./hubMetadataPaths";
import { hubFail } from "../hubJson";

const LIMIT = 16 * 1024 * 1024;

const encoder = new TextEncoder();

const decoder = new TextDecoder('utf-8', { fatal: true });

function decode(bytes: Uint8Array, paths: string[]): Map<string, Uint8Array> {
	if (bytes.length > LIMIT) return hubFail('metadata-too-large');
	const value: unknown = JSON.parse(decoder.decode(bytes));
	if (!Array.isArray(value) || value.length !== paths.length) return hubFail();
	const expected = new Set(paths),
		output = new Map<string, Uint8Array>();
	for (const item of value) {
		if (
			!Array.isArray(item) ||
			item.length !== 2 ||
			typeof item[0] !== 'string' ||
			typeof item[1] !== 'string' ||
			!expected.delete(item[0])
		)
			return hubFail();
		output.set(item[0], encoder.encode(item[1]));
	}
	return output;
}

async function load(context: HubSourceContext): Promise<Map<string, Uint8Array>> {
	const paths = hubMetadataPaths(context.entries);
	const identity = {
		...context.identity,
		requestedRef: context.commit,
		collaborationRevision: null,
		notesRevision: null,
		evidenceRevision: null,
		historyIndexRevision: null,
		profile: 'metadata-bundle',
		artifactHash: null
	};
	const cached = await readCache(context.cache, identity);
	if (cached) {
		try {
			return decode(cached, paths);
		} catch {
			await context.cache.delete(await cacheKey(identity));
		}
	}
	const data = await context.source.rawMany!(context.repository, { commit: context.commit, paths });
	const bytes = encoder.encode(
		JSON.stringify([...data].map(([path, value]) => [path, decoder.decode(value)]))
	);
	const result = decode(bytes, paths);
	await writeCache(context.cache, identity, bytes);
	return result;
}

/** One immutable bundle per principal/project/tree avoids a request per contract on cold loads. */
export async function hubMetadata(context: HubSourceContext): Promise<void> {
	if (!context.source.rawMany || context.metadata) return;
	context.metadataPending ??= load(context)
		.then((data) => {
			context.metadata = data;
		})
		.catch((error: unknown) => {
			context.metadataPending = undefined;
			throw error;
		});
	await context.metadataPending;
}
