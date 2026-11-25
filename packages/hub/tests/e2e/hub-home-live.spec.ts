import { expect, test } from '../../../../test/support/browserTest';
import { hubHomeFixture } from './hub-home-fixture';
import { homeData, mockup } from './hub-home-fixture-data';
import { linkedComputersFixture } from './linked-computers-fixture';
import { seedSealedHome, inspectSealedHome } from './sealed-home-fixture';
import { measureSealedHome, sealedHomeEvidence } from './sealed-home-evidence';
import { sealedHomeDelta } from './sealed-home-wire';

test.setTimeout(90000);

test('a signed-in account sees its linked Mac streaming sessions without connecting anything', async ({
	page
}) => {
	await hubHomeFixture(page, 'default');
	// No owner snapshot is stored for this account: only the Mac, over the encrypted channel, knows.
	await page.route('**/api/hub-home', (route) =>
		route.fulfill({ json: { granted: false, snapshot: null } })
	);
	await linkedComputersFixture(page, homeData(mockup('default')));
	await page.goto('/');
	await expect(page.getByRole('heading', { level: 1 })).toHaveText(/working, .* need[s]? you/);
	await expect(page.getByText('Connect your Mac')).toHaveCount(0);
	await expect(page.getByText('Connect a computer')).toHaveCount(0);
	await expect(page.locator('.hh-agent-list li').first()).toBeVisible();
	await expect(page.getByText('Unknown')).toHaveCount(0);
	if (process.env.TAKE_SCREENSHOT)
		await page.screenshot({ path: test.info().outputPath('live-home.png'), fullPage: true });
});

test('with no Mac linked and nothing stored, Home asks to connect a Mac as the fallback', async ({
	page
}) => {
	await hubHomeFixture(page, 'default');
	await page.route('**/api/hub-home', (route) =>
		route.fulfill({ json: { granted: false, snapshot: null } })
	);
	await page.goto('/');
	await expect(page.getByRole('heading', { level: 1 })).toHaveText('Connect your Mac');
});

test('an approved browser opens its previously viewed session before Sealed Sync answers', async ({
	page
}) => {
	await hubHomeFixture(page, 'default');
	await seedSealedHome(page);
	await page.route('**/api/sync/v1/**', () => {});
	await page.goto('/');
	await expect(page.locator('.hh-agent-list li').first()).toBeVisible();
	await page.evaluate(() => document.fonts.ready.then(() => {}));
	const session = page.getByText('Synthetic Mac session', { exact: true });
	const transcript = page.getByText('Cached transcript canary', { exact: true });
	await session.waitFor({ timeout: 5000 }).then(
		() => session.click(),
		() => {}
	);
	await transcript.waitFor({ timeout: 1000 }).catch(() => {});
	await sealedHomeEvidence(page, 'sealed-cached', (file) => test.info().outputPath(file));
	await expect(session).toBeVisible({ timeout: 5000 });
	await expect(transcript).toBeVisible();
});

test('a cached session accepts authenticated delta and live frames only', async ({ page }) => {
	const home = await hubHomeFixture(page, 'default');
	const fixture = await seedSealedHome(page);
	const delta = await sealedHomeDelta(page, fixture);
	await page.goto('/');
	await page.getByRole('button', { name: 'Synthetic Mac session' }).click();
	await expect(page.getByLabel('Transcript', { exact: true })).toHaveText(
		'Cached transcript canary'
	);
	const live = page.getByLabel('Live output', { exact: true });
	await expect(live).toHaveText('· Durable delta canaryLive frame canary');
	await expect.poll(() => delta.cursors.length).toBeGreaterThan(0);
	expect(delta.cursors).toEqual(delta.cursors.map(() => 2));
	delta.release();
	const transcript = 'Cached transcript canary · Durable delta canary';
	await expect(page.getByLabel('Transcript', { exact: true })).toHaveText(transcript);
	await expect(live).toHaveText('Live frame canary');
	expect(await inspectSealedHome(page, fixture.scope, delta.id)).toEqual({
		cursor: 3,
		envelope: delta.envelope,
		extractable: [false, false]
	});
	await page.evaluate(() => document.fonts.ready.then(() => {}));
	await sealedHomeEvidence(page, 'sealed-live', (file) => test.info().outputPath(file));

	await page.unroute('**/api/sync/v1/**');
	await page.route('**/api/sync/v1/**', () => {});
	await page.reload();
	const button = page.getByRole('button', { name: 'Synthetic Mac session' });
	await button.click();
	await expect(page.getByLabel('Transcript', { exact: true })).toHaveText(transcript);
	const measurement = await measureSealedHome(page, button, transcript);
	await test.info().attach('cached-session-render', {
		body: JSON.stringify(measurement),
		contentType: 'application/json'
	});
	expect(measurement.p50).toBeLessThanOrEqual(50);
	expect(measurement.p95).toBeLessThanOrEqual(100);

	home.state.actor = { ...home.state.actor, id: 'google:other-fixture-account' };
	await page.reload();
	await expect(page.getByRole('heading', { level: 1 })).toHaveText('Connect your Mac');
	await expect(page.getByRole('region', { name: 'Sessions', exact: true })).toHaveCount(0);
});
