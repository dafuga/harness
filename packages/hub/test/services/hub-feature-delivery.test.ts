import { expect, test } from 'vitest';
import {
	featureDeliveryApi,
	featureDeliverySource
} from '../../../../src/core/projects-sessions/featureDelivery';
import type {
	FeatureDelivery,
	FeatureDeliveryPage
} from '../../../../src/core/projects-sessions/featureDelivery.types';
import { serveFeatureDeliveries } from '../../src/routes/api/tracker-overview/deliveries/deliveryPolicy';
import { SESSION_COOKIE } from '../../src/utils/accounts-access/authCookies';
import { ORIGIN } from '../support/authFixture';
import { deliveryBucket } from '../support/deliveryBucket';
import { OTHER, overviewFixture } from '../support/trackerOverviewFixture';

const delivery: FeatureDelivery = {
	id: 'delivery01',
	title: 'Account settings',
	project: 'harness',
	at: '2026-11-28T14:06:00.000Z',
	stage: 'live',
	sha256: 'a'.repeat(64),
	durationSeconds: 25
};

test('owner feed lists newest first and filters unavailable and other-project videos', async () => {
	const { bucket, fetchOwner } = await fixture();
	const older = {
		...delivery,
		id: 'delivery02',
		at: '2026-11-27T14:06:00.000Z',
		stage: 'dev' as const
	};
	const missing = { ...delivery, id: 'delivery03' };
	const other = { ...delivery, project: 'other' };
	for (const entry of [older, delivery, missing, other]) await bucket.publish(entry);
	for (const entry of [older, delivery, other])
		await bucket.storeVideo(entry, Buffer.from('video'));
	const response = await fetchOwner(featureDeliveryApi + '?project=harness');
	expect(response.status).toBe(200);
	const page = (await response.json()) as FeatureDeliveryPage;
	expect(page.deliveries).toEqual([delivery, older]);
	expect(page.cursor).toBeNull();
});

test('private video supports seeking and refuses unauthenticated and non-owner reads', async () => {
	const { bucket, fetchOwner, fetchOther, handle } = await fixture();
	const source = featureDeliverySource(delivery);
	await bucket.storeVideo(delivery, Buffer.from('0123456789'));
	const forbidden = await fetchOther(source);
	expect(forbidden.status).toBe(403);
	expect((await handle(new Request(ORIGIN + source))).status).toBe(401);
	const response = await fetchOwner(source, { range: 'bytes=3-5' });
	expect(response.status).toBe(206);
	expect(response.headers.get('content-range')).toBe('bytes 3-5/10');
	expect(response.headers.get('content-type')).toBe('video/webm');
	expect(await response.text()).toBe('345');
	expect((await fetchOwner(source, { range: 'bytes=1024-' })).status).toBe(416);
});

async function fixture() {
	const auth = overviewFixture();
	const bucket = deliveryBucket();
	const handle = (request: Request) =>
		serveFeatureDeliveries(request, { ...auth.homeDeps(), bucket: bucket.r2 });
	const fetchWith =
		(cookie: string) =>
		(source: string, headers: Record<string, string> = {}) =>
			handle(
				new Request(ORIGIN + source, {
					headers: { cookie: `${SESSION_COOKIE}=${cookie}`, ...headers }
				})
			);
	return {
		bucket,
		handle,
		fetchOwner: fetchWith(await auth.browser()),
		fetchOther: fetchWith(await auth.browser(OTHER))
	};
}
