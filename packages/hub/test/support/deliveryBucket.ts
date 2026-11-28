import type { FeatureDelivery } from '../../../../src/core/projects-sessions/featureDelivery.types';
import {
	featureDeliveryReceiptKey,
	featureDeliveryVideoKey
} from '../../../../src/core/projects-sessions/featureDelivery';

export function deliveryBucket() {
	const objects = new Map<string, { bytes: Uint8Array; type: string }>();
	const r2 = {
		async list({ prefix, limit, cursor }: { prefix: string; limit: number; cursor?: string }) {
			const matches = [...objects.keys()]
				.sort()
				.filter((key) => key.startsWith(prefix) && key > (cursor ?? ''));
			const page = matches.slice(0, limit);
			return {
				objects: page.map((key) => ({ key })),
				truncated: matches.length > limit,
				cursor: page[page.length - 1]
			};
		},
		async head(key: string) {
			const found = objects.get(key);
			return found ? { size: found.bytes.length, httpMetadata: { contentType: found.type } } : null;
		},
		async get(key: string, options?: { range?: { offset: number; length: number } }) {
			const found = objects.get(key);
			if (!found) return null;
			const range = options?.range;
			const body = range
				? found.bytes.slice(range.offset, range.offset + range.length)
				: found.bytes;
			return {
				size: body.length,
				body: new Response(new Uint8Array(body)).body,
				json: async () => JSON.parse(new TextDecoder().decode(body))
			};
		}
	} as unknown as R2Bucket;
	return {
		r2,
		async storeVideo(delivery: FeatureDelivery, bytes: Buffer) {
			objects.set(featureDeliveryVideoKey(delivery.id, delivery.sha256), {
				bytes,
				type: 'video/webm'
			});
		},
		async publish(delivery: FeatureDelivery) {
			const bytes = new TextEncoder().encode(JSON.stringify(delivery));
			objects.set(featureDeliveryReceiptKey(delivery), { bytes, type: 'application/json' });
		}
	};
}
