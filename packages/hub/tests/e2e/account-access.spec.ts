import { expect, test } from '../../../../test/support/browserTest';
import { GoogleBrowserCallbackService } from '../../../desktop/src/services/accounts-access/GoogleBrowserCallbackService';
import { hostedFixture } from './hosted-fixture';
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

test('the account menu lists devices and removes only the selected device', async ({ page }) => {
	await hostedFixture(page);
	await page.route('**/api/hub-home', (route) =>
		route.fulfill({ json: { agents: [], plans: [], scheduled: [], quota: [] } })
	);
	const device = {
		id: 'fixture-device',
		name: 'Office Mac',
		lastSeenAt: '2026-11-23T12:00:00.000Z'
	};
	let connected = true;
	await page.route('**/api/auth/native/devices', (route) => {
		const request = route.request();
		if (request.method() === 'GET')
			return route.fulfill({ json: { devices: connected ? [device] : [] } });
		expect(request.postDataJSON()).toEqual({ id: device.id });
		connected = false;
		return route.fulfill({ json: { ok: true } });
	});
	await page.goto('/');
	await page.getByRole('button', { name: 'Account', exact: true }).click();
	await page.getByRole('link', { name: 'Devices', exact: true }).click();
	await expect(page.getByRole('heading', { name: 'Devices', exact: true })).toBeVisible();
	await expect(page.getByText('Office Mac')).toBeVisible();
	await expect(page.getByText('Last seen', { exact: false })).toBeVisible();
	if (process.env.TAKE_SCREENSHOT === 'true') {
		await page.evaluate(() => document.fonts.ready);
		await page.screenshot({ path: `/tmp/harness-hub-devices-${process.env.SCREENSHOT_LABEL}.png` });
	}
	await page.getByRole('button', { name: 'Remove Office Mac' }).click();
	await page.getByRole('button', { name: 'Confirm removal' }).click();
	await expect(page.getByText('No desktop or iOS devices are signed in.')).toBeVisible();
});

test('Google sign-in returns to the desktop loopback without typing a code', async ({ page }) => {
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
		await page.getByRole('button', { name: 'Continue to Harness' }).click();
		await expect(page).toHaveURL(origin + '/return-to-harness');
		await expect(page.getByText('Return to Harness to finish signing in.')).toBeVisible();
		expect(callback.take()).toBe(callbackCode);
		expect(page.url()).not.toContain(callbackCode);
	} finally {
		callback.close();
	}
});
