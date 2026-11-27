import { expect, test } from '../../../../test/support/browserTest';
import { GoogleBrowserCallbackService } from '../../../desktop/src/services/accounts-access/GoogleBrowserCallbackService';
import { hostedFixture } from './hosted-fixture';
import { linkedComputersFixture } from './linked-computers-fixture';
import { macRelease } from './hosted-home';

const signIn = { name: 'Sign in with Google' };

test('the Hub opens at Google sign-in and shows Home only after authentication', async ({
	page
}) => {
	const state = await hostedFixture(page, { signedIn: false });
	await macRelease(page, 'page');
	await page.route('**/api/hub-home', (route) =>
		route.fulfill({ json: { agents: [], plans: [], scheduled: [], quota: [] } })
	);
	await page.goto('/');
	await expect(page.locator('main:not([aria-busy="true"])').first()).toBeVisible();
	if (process.env.TAKE_SCREENSHOT === 'true') {
		await page.evaluate(() => document.fonts.ready);
		await page.screenshot({
			path: `/tmp/harness-hub-account-${process.env.SCREENSHOT_LABEL ?? 'proof'}.png`
		});
	}
	await expect(page.getByRole('button', signIn)).toBeVisible();
	expect(state.calls.some((call) => call.path === '/api/projects')).toBe(false);
	await page.getByRole('button', signIn).click();
	await expect(page.locator('[data-harness-component="hub-home"]')).toBeVisible();
	await expect(page).toHaveURL(/\/$/);
	await expect(page.getByRole('button', signIn)).toHaveCount(0);
});

test('the account menu lists signed-in devices and reaches the linked Macs', async ({
	page,
	browserErrors
}, testInfo) => {
	await hostedFixture(page);
	await linkedComputersFixture(page);
	await page.route('**/api/hub-home', (route) =>
		route.fulfill({ json: { agents: [], plans: [], scheduled: [], quota: [] } })
	);
	const device = {
		id: 'fixture-device',
		name: 'Office Mac',
		lastSeenAt: '2026-11-23T12:00:00.000Z'
	};
	const browser = { ...device, id: 'fixture-browser', name: 'Web browser' };
	let connected = true;
	await page.route(/\/api\/(account|auth\/native)\/devices$/, (route) => {
		const request = route.request();
		if (request.method() === 'GET') {
			const native = connected ? [device] : [];
			const json = request.url().endsWith('/account/devices')
				? { devices: [browser, ...native], currentDeviceId: browser.id }
				: { devices: native };
			return route.fulfill({ json });
		}
		expect(request.postDataJSON()).toEqual({ id: device.id });
		connected = false;
		return route.fulfill({ json: { ok: true } });
	});
	await page.goto('/');
	await page.getByRole('button', { name: 'Account', exact: true }).click();
	await page.getByRole('link', { name: 'Devices', exact: true }).click();
	await expect(page.getByRole('heading', { name: 'Devices', exact: true })).toBeVisible();
	await expect(page.getByText('Office Mac')).toBeVisible();
	const linked = page.getByRole('list', { name: 'Linked computers' });
	await expect(linked.getByText('Studio Mac')).toBeVisible();
	let failedPoll = '';
	await page.route(
		'**/pairing/*/poll',
		async (route) => {
			failedPoll = route.request().url();
			browserErrors.expectError({
				type: 'console',
				message:
					'Failed to load resource: the server responded with a status of 503 (Service Unavailable)',
				source: failedPoll,
				reason: 'The first pairing poll deliberately returns a temporary relay failure.'
			});
			await route.fulfill({ status: 503, json: { error: 'unavailable' } });
		},
		{ times: 1 }
	);
	await linked.getByRole('button', { name: 'Connect to Desk Mac' }).click();
	const desk = page.getByRole('dialog', { name: 'Desk Mac' });
	await expect(desk.getByRole('list', { name: 'Projects on this Mac' })).toContainText(
		'Desk project'
	);
	expect(failedPoll).toBeTruthy();
	await expect(page).toHaveURL(/\/devices$/);
	if (process.env.TAKE_SCREENSHOT === 'true') {
		for (const width of [1440, 820, 390]) {
			await page.setViewportSize({ width, height: 900 });
			await expect(desk.getByText('Desk project')).toBeVisible();
			await page.evaluate(() => document.fonts.ready);
			await page.mouse.move(0, 0);
			await page.screenshot({ path: testInfo.outputPath(`browser-linked-mac-${width}.png`) });
		}
		await page.setViewportSize({ width: 1280, height: 720 });
	}
	await page.keyboard.press('Escape');
	await expect(desk).toHaveCount(0);
	const mac = page.getByRole('listitem').filter({ hasText: 'Office Mac' });
	await expect(mac.getByText('Last seen', { exact: false })).toBeVisible();
	if (process.env.TAKE_SCREENSHOT === 'true') {
		await page.evaluate(() => document.fonts.ready);
		await page.screenshot({ path: `/tmp/harness-hub-devices-${process.env.SCREENSHOT_LABEL}.png` });
	}
	const currentBrowser = page.getByRole('listitem').filter({ hasText: 'Web browser' });
	await expect(currentBrowser.getByText('This browser')).toBeVisible();
	await expect(currentBrowser.getByRole('button', { name: 'Remove Web browser' })).toHaveCount(0);
	await page.getByRole('button', { name: 'Remove Office Mac' }).click();
	await page.getByRole('button', { name: 'Confirm removal' }).click();
	await expect(page.getByText('Office Mac')).toHaveCount(0);
	await expect(currentBrowser).toBeVisible();
	await linked.getByRole('button', { name: 'Manage Studio Mac' }).click();
	await page.getByRole('button', { name: 'Confirm unlink' }).click();
	await expect(linked.getByText('Studio Mac')).toHaveCount(0);
	await expect(linked.getByText('Desk Mac')).toBeVisible();
});

test('Google sign-in returns to the desktop loopback without typing a code', async ({
	page
}, testInfo) => {
	await page.setViewportSize({ width: 390, height: 844 });
	await hostedFixture(page, { signedIn: false });
	const handoffId = 'h'.repeat(43);
	const callbackCode = 'c'.repeat(43);
	const callback = new GoogleBrowserCallbackService();
	const port = await callback.listen();
	callback.expect(handoffId);
	const origin = `http://127.0.0.1:${port}`;
	await page.route('**/api/auth/native/return', (route) => {
		expect(route.request().postDataJSON()).toEqual({ handoffId });
		return route.fulfill({
			json: { callbackUrl: `${origin}/harness-account?state=${handoffId}&code=${callbackCode}` }
		});
	});
	try {
		await page.goto(`/native/${handoffId}?return=1`);
		await page.getByRole('button', signIn).click();
		const proceed = page.getByRole('button', { name: 'Continue to Harness' });
		const switchAccount = page.getByRole('button', { name: 'Use another Google account' });
		await expect(proceed).toBeVisible();
		await expect(switchAccount).toBeVisible();
		if (process.env.TAKE_SCREENSHOT === 'true') {
			await page.evaluate(() => document.fonts.ready);
			await page.screenshot({ path: testInfo.outputPath('connect-device.png') });
		}
		const primary = (await proceed.boundingBox())!;
		const secondary = (await switchAccount.boundingBox())!;
		expect(
			Math.max(secondary.y - primary.y - primary.height, secondary.x - primary.x - primary.width),
			'Account actions have at least 12 px of separation'
		).toBeGreaterThanOrEqual(12);
		await proceed.click();
		await expect(page).toHaveURL(origin + '/return-to-harness');
		await expect(page.getByText('Return to Harness to finish signing in.')).toBeVisible();
		expect(callback.take()).toBe(callbackCode);
		expect(page.url()).not.toContain(callbackCode);
	} finally {
		callback.close();
	}
});
