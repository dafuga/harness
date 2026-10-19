import { expect, test } from '../../../../test/support/browserTest';
import { atlas, hostedFixture } from './hosted-fixture';
import { handoff, userCode } from './hosted-native';

const field = { name: 'Code shown on your Harness device', exact: true };
const approve = { name: 'Approve this device', exact: true };

test('the approval page names what is asked, and takes the typed code in a body, never an address', async ({
	page,
	browserErrors,
	baseURL
}) => {
	browserErrors.expectError({
		type: 'console',
		message: 'Failed to load resource: the server responded with a status of 400 (Bad Request)',
		source: new URL(`/api/auth/native/approve`, baseURL).href,
		reason: 'Deliberately submitting the wrong device approval code verifies rejection.'
	});
	const state = await hostedFixture(page, { signedIn: false });
	await page.goto(`/native/${handoff}`);
	await expect(page.getByRole('heading', { name: 'Connect a Harness device' })).toBeVisible();
	await expect(page.getByRole('textbox')).toHaveCount(0);
	await page.getByRole('button', { name: 'Sign in with Google' }).click();
	await expect(page.getByText('every shared project you can open, now and later')).toBeVisible();
	await expect(page.getByText(/Never type a code\s+that someone sent you/)).toBeVisible();
	await expect(page.getByText(/writers can ask agents to make changes/)).toBeVisible();
	if (process.env.TAKE_SCREENSHOT === 'true') {
		await page.evaluate(() => document.fonts.ready);
		await page.screenshot({
			path: `/tmp/harness-google-native-approval-${process.env.SCREENSHOT_LABEL ?? 'proof'}.png`,
			fullPage: true
		});
	}
	const approvals = () => state.calls.filter((call) => call.path.endsWith('/native/approve'));
	expect(approvals()).toEqual([]);
	await page.getByRole('textbox', field).fill('wxyz-0000');
	await page.getByRole('button', approve).click();
	await expect(page.getByRole('alert')).toContainText(/wrong, expired or already used/);
	await page.getByRole('textbox', field).fill(` ${userCode.toLowerCase()} `);
	await page.getByRole('button', approve).click();
	await expect(page.getByRole('heading', { name: 'Approved', exact: true })).toBeVisible();
	await expect(page.getByRole('textbox')).toHaveCount(0);
	expect(approvals().map((call) => call.body)).toEqual([
		{ handoffId: handoff, userCode: 'WXYZ-0000' },
		{ handoffId: handoff, userCode }
	]);
	expect(page.url()).not.toContain(userCode);
	expect(state.calls.filter((call) => JSON.stringify(call.query).includes(userCode))).toEqual([]);
	expect(state.calls.filter((call) => call.path.includes(userCode))).toEqual([]);
});

test('a request for one project names that project', async ({ page }) => {
	await hostedFixture(page, { native: { status: 'pending', resource: `project:${atlas}` } });
	await page.goto(`/native/${handoff}`);
	await expect(page.getByText('the project “Atlas” only')).toBeVisible();
	await expect(page.getByRole('button', approve)).toBeDisabled();
});

test('an expired request offers nothing to approve', async ({ page }) => {
	const state = await hostedFixture(page, { native: { status: 'expired', resource: 'projects' } });
	await page.goto(`/native/${handoff}`);
	await expect(page.getByRole('heading', { name: 'This request has expired' })).toBeVisible();
	await expect(page.getByRole('textbox')).toHaveCount(0);
	expect(state.calls.filter((call) => call.path.endsWith('/native/approve'))).toEqual([]);
});
