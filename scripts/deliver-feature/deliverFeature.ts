// @harness-uid u_fakvbxkf72
import { createHash } from 'node:crypto';
import {
	featureDeliverySchema,
	featureDeliverySource
} from '../../src/core/projects-sessions/featureDelivery';
import { sanitizeTrackerText } from '../../src/utils/projects-sessions/sanitizeTrackerText';
import type { DeliveryInput, DeliveryServices } from './deliverFeature.types';
import { ExpectedCliError } from '../../src/core/errors';

/** Make the clip durable before completion, then expose the delivery on the project page. */
export async function deliverFeature(input: DeliveryInput, services: DeliveryServices) {
	const item = await services.readItem(input.id);
	if (item.sensitive || item.deleted || item.recurring || item.status === 'ignored')
		throw new ExpectedCliError('Tracker item cannot publish feature evidence');
	if ((item.status === 'done') !== Boolean(input.attach || input.backfillAt))
		throw new ExpectedCliError('Use --attach or --backfill-at for an already completed item');
	const capture = await services.capture();
	if (!capture.bytes.length) throw new ExpectedCliError('The feature video is empty');
	const delivery = featureDeliverySchema.parse({
		id: item.id,
		project: item.agent,
		title: sanitizeTrackerText(item.title ?? '').trim(),
		at: input.backfillAt ?? services.now().toISOString(),
		stage: input.stage,
		sha256: createHash('sha256').update(capture.bytes).digest('hex'),
		durationSeconds: capture.durationSeconds
	});
	const url = new URL(featureDeliverySource(delivery), input.origin).href;
	const label = `Feature video · ${delivery.stage}`;
	await services.storeVideo(delivery, capture.bytes);
	await services.attach(item.id, { links: [{ label, url }] });
	await services.record(
		item.id,
		[input.note, `${label} ${url}`].filter(Boolean).join('\n'),
		item.status !== 'done'
	);
	await services.publish(delivery);
	return { delivery, url };
}
