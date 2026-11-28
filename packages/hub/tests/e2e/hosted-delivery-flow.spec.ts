import { join } from 'node:path';
import { mkdir } from 'node:fs/promises';
import { expect, test } from '../../../../test/support/browserTest';
import { deliverFeature } from '../../../../scripts/deliver-feature/deliverFeature';
import { featureDeliverySource } from '../../../../src/utils/projects-sessions/featureDelivery';
import { deliveryBucket } from '../../test/support/deliveryBucket';
import {
	deliveryId,
	deliveryPath,
	deliveryTitle,
	fixtureTracker,
	recordProjectWalkthrough,
	routeDeliveryFeed
} from './feature-delivery-fixture';
import { overviewFixture, viewports } from './tracker-overview-fixture';

test('a recorded feature updates Tracker and plays on the Hub project page', async ({
	browser,
	page,
	baseURL,
	browserErrors
}, testInfo) => {
	test.setTimeout(120_000);
	const directory = process.env.HEADLESS_RUN_ARTIFACTS ?? testInfo.outputDir;
	await mkdir(directory, { recursive: true });
	const { tracker, close } = fixtureTracker();
	const store = deliveryBucket();
	try {
		await overviewFixture(page);
		await routeDeliveryFeed(page, store);
		await page.goto(deliveryPath);
		const region = page.getByRole('region', { name: 'Delivered features' });
		await expect(region.getByText('No delivery videos yet.')).toBeVisible();
		const { delivery, url } = await deliverFeature(
			{
				id: deliveryId,
				stage: 'dev',
				origin: 'https://hub.example.invalid',
				note: 'Headless built-app proof'
			},
			{
				...tracker,
				...store,
				capture: () =>
					recordProjectWalkthrough(browser, {
						baseURL: baseURL!,
						directory,
						onContext: browserErrors.watch
					}),
				now: () => new Date('2026-11-28T14:30:00.000Z')
			}
		);
		const item = await tracker.readItem(deliveryId);
		expect(item.status).toBe('done');
		expect(item.planning.artifacts.build?.links).toEqual([{ label: 'Feature video · dev', url }]);
		expect(item.notes_log.some(({ text }) => text.includes(url))).toBe(true);
		expect(delivery.durationSeconds).toBeGreaterThanOrEqual(20);
		expect(delivery.durationSeconds).toBeLessThanOrEqual(60);
		await page.reload();
		const player = region.locator('video');
		await expect(region.getByRole('heading', { name: deliveryTitle })).toBeVisible();
		await expect(player).toHaveAttribute('src', featureDeliverySource(delivery));
		await player.evaluate(async (video: HTMLVideoElement) => video.play());
		await expect
			.poll(() => player.evaluate((video: HTMLVideoElement) => video.currentTime))
			.toBeGreaterThan(0.2);
		await player.evaluate((video: HTMLVideoElement) => {
			video.pause();
			video.currentTime = 5;
		});
		await expect
			.poll(() => player.evaluate((video: HTMLVideoElement) => !video.seeking))
			.toBe(true);
		for (const { id, width, height } of viewports) {
			await page.setViewportSize({ width, height });
			await expect
				.poll(() => page.evaluate(() => document.documentElement.scrollWidth))
				.toBeLessThanOrEqual(width);
			await page.screenshot({
				path: join(directory, `delivered-feature-${id}.png`),
				fullPage: true
			});
		}
	} finally {
		close();
	}
});
