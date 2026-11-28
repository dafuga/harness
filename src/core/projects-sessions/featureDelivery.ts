// @harness-uid u_26kwgq7ii2
import { z } from 'zod';
import type { FeatureDelivery } from './featureDelivery.types';

export const featureDeliveryStages = ['dev', 'staging', 'live'] as const;
export const featureDeliveryStage = z.enum(featureDeliveryStages);
export const featureDeliveryId = z.string().regex(/^[a-z0-9]{6,64}$/);
export const featureDeliveryDigest = z.string().regex(/^[a-f0-9]{64}$/);
export const featureDeliveryProject = z
	.string()
	.min(1)
	.max(200)
	.regex(/^[^\p{Cc}/]+$/u);
export const featureDeliveryDuration = z.number().min(20).max(60);

export const featureDeliverySchema = z.strictObject({
	id: featureDeliveryId,
	project: featureDeliveryProject,
	title: z.string().min(1).max(500),
	at: z.iso.datetime({ precision: 3 }),
	stage: featureDeliveryStage,
	sha256: featureDeliveryDigest,
	durationSeconds: featureDeliveryDuration
});

export const featureDeliveryPageSchema = z.strictObject({
	deliveries: z.array(featureDeliverySchema).max(12),
	cursor: z.string().max(4096).nullable()
});

export const featureDeliveryApi = '/api/tracker-overview/deliveries';

export function featureDeliveryPrefix(project: string) {
	return `feature-delivery/v1/${encodeURIComponent(project)}/`;
}

export function featureDeliveryReceiptKey(value: FeatureDelivery) {
	const descending = String(9_999_999_999_999 - Date.parse(value.at)).padStart(13, '0');
	return featureDeliveryPrefix(value.project) + `${descending}-${value.id}-${value.stage}.json`;
}

export function featureDeliverySource(value: Pick<FeatureDelivery, 'id' | 'sha256'>) {
	return featureDeliveryApi + '?' + new URLSearchParams({ item: value.id, sha: value.sha256 });
}

export function featureDeliveryVideoKey(id: string, sha256: string) {
	return `feature-delivery/videos/${id}/${sha256}.webm`;
}
