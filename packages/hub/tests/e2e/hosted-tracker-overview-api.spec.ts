import { expect, test } from '../../../../test/support/browserTest';
import { buildStamp } from '../../../../src/utils/buildStamp';
import { recordCapture } from '../../../../src/utils/reports-media/record-capture/recordCapture';
import { SESSION_COOKIE } from '../../src/utils/accounts-access/authCookies';
import { ORIGIN } from '../../test/support/authFixture';
import {
	OTHER,
	OWNER,
	overviewFixture as apiFixture,
	overviewRequest,
	snapshot
} from '../../test/support/trackerOverviewFixture';
import { hostedFixture } from './hosted-fixture';

// Synthetic records only. The compiled /tracker-overview page runs in Chromium; its own
// /api/tracker-overview HTTP is answered by the actual serveTrackerOverview handler through a
// route, with a real synthetic session. Run on harbor-mbp-2 with one worker.

const path = '/api/tracker-overview';

/** Routes the page's overview HTTP into the real handler, carrying the given browser session cookie. */
async function routeToHandler(
	page: import('@playwright/test').Page,
	fixture: ReturnType<typeof apiFixture>,
	cookie: string,
	calls: { method: string; path: string; query: string }[]
) {
	await page.route('**/api/tracker-overview', async (route) => {
		const sent = route.request();
		const url = new URL(sent.url());
		calls.push({ method: sent.method(), path: url.pathname, query: url.search });
		const response = await fixture.handle(
			new Request(sent.url(), {
				method: sent.method(),
				headers: { cookie: `${SESSION_COOKIE}=${cookie}`, origin: ORIGIN }
			})
		);
		await route.fulfill({
			status: response.status,
			headers: Object.fromEntries(response.headers),
			body: await response.text()
		});
	});
}

test('the owner publishes natively; the page renders it with only GET calls and no credentials in logs', async ({
	page
}, testInfo) => {
	const fixture = apiFixture();
	const bearer = await fixture.native(OWNER);
	const cookie = await fixture.browser(OWNER);
	const put = await fixture.handle(overviewRequest('PUT', { bearer }, snapshot()));
	expect(put.status).toBe(204);

	const logs: string[] = [];
	page.on('console', (message) => logs.push(message.text()));
	await hostedFixture(page, {
		actor: { id: OWNER.id, email: OWNER.email, name: OWNER.name, emailVerified: true }
	});
	const calls: { method: string; path: string; query: string }[] = [];
	await routeToHandler(page, fixture, cookie, calls);
	await page.setViewportSize({ width: 1440, height: 900 });
	await page.goto('/tracker-overview');
	await expect(page.getByText('synthetic-project', { exact: true })).toBeVisible();

	expect(calls.length).toBeGreaterThan(0);
	expect(calls.every((call) => call.method === 'GET' && call.path === path)).toBe(true);
	expect(calls.every((call) => call.query === '')).toBe(true);
	const visible = await page.content();
	for (const secret of [bearer, cookie]) {
		expect(visible).not.toContain(secret);
		expect(logs.join('\n')).not.toContain(secret);
	}

	const timing = await page.evaluate(() => {
		const [entry] = performance.getEntriesByType('navigation') as PerformanceNavigationTiming[];
		const memory = (performance as Performance & { memory?: { usedJSHeapSize: number } }).memory;
		return {
			loadEventEnd: entry?.loadEventEnd ?? null,
			jsHeapBytes: memory?.usedJSHeapSize ?? null
		};
	});
	await testInfo.attach('tracker-overview-hub-timing-desktop.json', {
		body: JSON.stringify({ viewport: 'desktop', ...timing }),
		contentType: 'application/json'
	});
	await captureOwnerReady(page, testInfo);
});

/** The published owner state, from the compiled page's own stamp and the canonical desktop viewport. */
async function captureOwnerReady(
	page: import('@playwright/test').Page,
	testInfo: import('@playwright/test').TestInfo
) {
	await page.evaluate(() => document.fonts.ready);
	const stamp = await page.locator('meta[name="harness-build"]').getAttribute('content');
	const buildId = buildStamp(stamp ?? undefined);
	const revision = process.env.HARNESS_VERIFY_REVISION;
	expect(buildId, 'The compiled Hub page must carry its build identity').toBeTruthy();
	expect(revision, 'Evidence must identify the verification revision').toMatch(/^[a-f0-9]{40}$/);
	const body = await page.screenshot({ fullPage: true, animations: 'disabled', caret: 'hide' });
	await testInfo.attach('tracker-overview-hub-owner-ready-desktop.png', {
		body,
		contentType: 'image/png'
	});
	recordCapture(
		{
			evidence: 'owner-page',
			kind: 'screenshot',
			state: 'owner-ready',
			viewport: 'desktop',
			file: 'hub-owner-ready-desktop.png',
			mediaType: 'image/png',
			provenance: 'actual-capture',
			server: { buildId: buildId!, revision: revision! },
			note: 'Compiled Hub page; owner published natively through serveTrackerOverview; synthetic records.'
		},
		body
	);
}

test('the same handler answers 401, 403 and 503, and no answer carries a credential', async () => {
	const fixture = apiFixture();
	const bearer = await fixture.native(OWNER);
	const stranger = await fixture.browser(OTHER);
	const denied = await fixture.handle(overviewRequest('GET', { cookie: stranger }));
	const anonymous = await fixture.handle(overviewRequest('GET'));
	const unavailable = await fixture.handle(overviewRequest('GET', { bearer }));
	expect(anonymous.status).toBe(401);
	expect(denied.status).toBe(403);
	expect(unavailable.status).toBe(503);
	const answers = [anonymous, denied, unavailable];
	const texts = await Promise.all(answers.map((response) => response.text()));
	expect(JSON.parse(texts[2])).toEqual({ status: 'unavailable' });
	for (const [index, response] of answers.entries()) {
		expect(response.headers.get('cache-control')).toBe('private, no-store');
		expect(texts[index]).not.toContain(bearer);
		expect(texts[index]).not.toContain(stranger);
	}
});
