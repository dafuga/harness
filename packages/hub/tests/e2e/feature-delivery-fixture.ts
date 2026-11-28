import type { Browser, Page } from '@playwright/test';
import { join } from 'node:path';
import { readFile } from 'node:fs/promises';
import { pathToFileURL } from 'node:url';
import { openSqlite } from '../../../../src/adapters/development-tooling/openSqlite';
import { TrackerItemReadRepository } from '../../../../src/repositories/projects-sessions/TrackerItemReadRepository';
import { TrackerLocalApiService } from '../../../../src/services/projects-sessions/TrackerLocalApiService';
import { TrackerPersistenceService } from '../../../../src/services/projects-sessions/TrackerPersistenceService';
import type { DeliveryServices } from '../../../../scripts/deliver-feature/deliverFeature.types';
import { expect } from '../../../../test/support/browserTest';
import { deliveryBucket } from '../../test/support/deliveryBucket';
import { overviewFixture as authFixture } from '../../test/support/trackerOverviewFixture';
import { SESSION_COOKIE } from '../../src/utils/accounts-access/authCookies';
import { serveFeatureDeliveries } from '../../src/routes/api/tracker-overview/deliveries/deliveryPolicy';
import { overviewFixture } from './tracker-overview-fixture';

export const deliveryId = 'delivery01';
export const deliveryTitle = 'Mock project walkthrough';
export const deliveryProject = 'synthetic-sync';
export const deliveryPath = '/tracker-overview?project=' + deliveryProject;

export function fixtureTracker() {
	const database = openSqlite(':memory:');
	const store = new TrackerPersistenceService(database, 'delivery-test');
	const api = new TrackerLocalApiService(store, new TrackerItemReadRepository(database));
	const fields = {
		title: deliveryTitle,
		agent: deliveryProject,
		status: 'in_progress',
		kind: 'task'
	};
	store.appendLocal({ itemId: deliveryId, fields });
	const endpoint = 'http://127.0.0.1/items/';
	const request = (path: string, body?: object) =>
		api.handle(
			new Request(endpoint + path, {
				method: body ? 'POST' : 'GET',
				body: body ? JSON.stringify(body) : null
			})
		);
	const tracker: Pick<DeliveryServices, 'readItem' | 'attach' | 'record'> = {
		readItem: async (id) => (await request(id)).json(),
		attach: async (id, artifact) => {
			const result = await request(id + '/artifact', {
				stage: 'build',
				artifact,
				merge_links: true
			});
			expect(result.status).toBe(200);
		},
		record: async (id, note, complete) => {
			const result = await request(
				id + (complete ? '/done' : '/note'),
				complete ? { note } : { text: note }
			);
			expect(result.status).toBe(200);
		}
	};
	return { tracker, close: () => database.close() };
}

export async function routeDeliveryFeed(page: Page, bucket: ReturnType<typeof deliveryBucket>) {
	const auth = authFixture();
	const cookie = await auth.browser();
	await page.route('**/api/tracker-overview/deliveries?*', async (route) => {
		const sent = route.request();
		const response = await serveFeatureDeliveries(
			new Request(sent.url(), {
				method: sent.method(),
				headers: { ...sent.headers(), cookie: `${SESSION_COOKIE}=${cookie}` }
			}),
			{ ...auth.homeDeps(), bucket: bucket.r2 }
		);
		await route.fulfill({
			status: response.status,
			headers: Object.fromEntries(response.headers),
			body: Buffer.from(await response.arrayBuffer())
		});
	});
}

export async function recordProjectWalkthrough(
	browser: Browser,
	options: {
		baseURL: string;
		directory: string;
		onContext: (context: import('@playwright/test').BrowserContext) => void;
	}
) {
	const { baseURL, directory, onContext } = options;
	const viewport = { width: 1040, height: 660 };
	const context = await browser.newContext({
		baseURL,
		viewport,
		recordVideo: { dir: directory, size: viewport }
	});
	onContext(context);
	let video;
	try {
		const page = await context.newPage();
		video = page.video();
		await overviewFixture(page);
		await addMockBadge(page);
		await page.goto(deliveryPath);
		await expect(page.getByText('MOCK', { exact: true })).toBeVisible();
		await expect(page.getByRole('heading', { level: 1, name: deliveryProject })).toBeVisible();
		await new Promise((resolve) => setTimeout(resolve, 6000));
		await page.getByRole('button', { name: 'Open item' }).first().click();
		await expect(page.getByRole('dialog')).toBeVisible();
		await new Promise((resolve) => setTimeout(resolve, 8000));
		await page.keyboard.press('Escape');
		await expect(page.getByRole('dialog')).toHaveCount(0);
		await new Promise((resolve) => setTimeout(resolve, 7000));
	} finally {
		await context.close();
	}
	if (!video) throw new Error('The delivery walkthrough had no video');
	const file = join(directory, 'feature-delivery.webm');
	await video.saveAs(file);
	return inspectWalkthrough(browser, file, onContext);
}

async function addMockBadge(page: Page) {
	await page.addInitScript(() => {
		document.addEventListener('DOMContentLoaded', () => {
			const badge = document.createElement('strong');
			badge.textContent = 'MOCK';
			badge.style.cssText =
				'position:fixed;right:16px;bottom:16px;z-index:999999;padding:8px 14px;border-radius:6px;background:#231751;color:#fff;font:600 14px system-ui';
			document.body.append(badge);
		});
	});
}

async function inspectWalkthrough(
	browser: Browser,
	file: string,
	onContext: (context: import('@playwright/test').BrowserContext) => void
) {
	const context = await browser.newContext();
	onContext(context);
	try {
		const page = await context.newPage();
		await page.goto(pathToFileURL(file).href);
		const video = page.locator('video');
		await expect
			.poll(() => video.evaluate((element: HTMLVideoElement) => element.readyState))
			.toBeGreaterThan(0);
		const durationSeconds = await video.evaluate((element: HTMLVideoElement) => element.duration);
		return { bytes: await readFile(file), durationSeconds };
	} finally {
		await context.close();
	}
}
