import {
	featureDeliveryPrefix,
	featureDeliveryReceiptKey,
	featureDeliverySchema,
	featureDeliveryVideoKey
} from '../../../../../../../src/utils/projects-sessions/featureDelivery';
import type { FeatureDelivery } from '../../../../../../../src/utils/projects-sessions/featureDelivery.types';

export async function deliveryFeed(bucket: R2Bucket, project: string, cursor?: string) {
	const { objects, ...page } = await bucket.list({
		prefix: featureDeliveryPrefix(project),
		limit: 12,
		cursor
	});
	const deliveries = await Promise.all(
		objects.map(({ key }) => readDelivery(bucket, project, key))
	);
	return {
		deliveries: deliveries.filter((entry): entry is FeatureDelivery => entry !== null),
		cursor: page.truncated ? page.cursor : null
	};
}

async function readDelivery(bucket: R2Bucket, project: string, key: string) {
	const object = await bucket.get(key);
	if (!object || object.size > 8 * 1024) return null;
	const json = await object.json().catch(() => null);
	const result = featureDeliverySchema.safeParse(json);
	if (!result.success || result.data.project !== project) return null;
	const entry = result.data;
	if (featureDeliveryReceiptKey(entry) !== key) return null;
	const video = await bucket.head(featureDeliveryVideoKey(entry.id, entry.sha256));
	return video && video.size > 0 && video.httpMetadata?.contentType === 'video/webm' ? entry : null;
}
