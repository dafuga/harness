import { createHash } from 'node:crypto';
import { commits } from '../../../../test/entityUnits';
import type { Data } from './illustratedData.types';
import { explorerArtifact } from '../../../../src/utils/explorerArtifact';

/** Desktop-only examples retain their own bytes and hashes; shared integrity fixtures are unchanged. */
export async function desktopArtifactFixtures(original: Data) {
	const bytes: Data['bytes'] = {};
	const hashes: Record<string, string> = {};
	for (const [hash, value] of Object.entries(original.bytes)) {
		if (!value.mediaType.includes('json')) continue;
		const document = JSON.parse(describe(Buffer.from(value.data).toString()));
		if (Array.isArray(document.steps))
			document.steps = document.steps.map((step: unknown) =>
				typeof step === 'string' && step.startsWith('Search for ')
					? { action: 'search', text: step.slice('Search for '.length) }
					: step
			);
		const body = Buffer.from(JSON.stringify(document, null, 2));
		const sha256 = createHash('sha256').update(body).digest('hex');
		hashes[hash] = sha256;
		bytes[sha256] = { mediaType: value.mediaType, data: [...body] };
	}
	let serialized = describe(JSON.stringify(original.results));
	for (const [before, after] of Object.entries(hashes))
		serialized = serialized.replaceAll(before, after);
	const results = JSON.parse(serialized) as Data['results'];
	const bindings = Object.fromEntries(
		Object.entries(original.bindings).map(([key, hash]) => [key, hashes[hash] ?? hash])
	);
	const body = Buffer.from(
		'Recorded plain text output.\nWorkload: order-name filtering\nQuery: service\nInput: 12 orders in their original order\nMatches: Service call; Service plan\nOriginal row objects and ordering were preserved.\nResult: passed'
	);
	const sha256 = createHash('sha256').update(body).digest('hex');
	bytes[sha256] = { mediaType: 'text/plain', data: [...body] };
	const sample = Object.values(results)
		.flatMap((result) => result.behavior.rows)
		.find((row) => row.after?.mediaType.includes('json'))!.after!;
	const capture = { ...sample, sha256, mediaType: 'text/plain', media: `media/${sha256}.txt` };
	const read = await explorerArtifact(capture, '', async () => ({
		ok: true,
		status: 200,
		arrayBuffer: async () => new Uint8Array(body).buffer
	}));
	return { results, bindings, bytes, text: { capture, read } };
}

function describe(text: string) {
	let described = text
		.replaceAll('Search across synthetic orders', 'Search orders by name')
		.replaceAll('Orders page over synthetic orders', 'Orders list')
		.replaceAll('Twelve synthetic orders', '12 orders with service and product lines');
	for (const [commit, at] of [
		[commits.first, '2026-10-08T08:45:00Z'],
		[commits.middle, '2026-10-10T10:24:00Z'],
		[commits.tip, '2026-10-12T16:20:00Z']
	])
		described = described.replaceAll(`taken for ${commit.slice(0, 7)}`, at);
	return described;
}
