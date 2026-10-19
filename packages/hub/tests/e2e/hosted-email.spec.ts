import { expect, test, type Page } from '../../../../test/support/browserTest';
import { ada, atlas, hostedFixture, type HostedState } from './hosted-fixture';
import { emailCode, thirdPartyCredential, unsent } from './hosted-email';
import { emailCode as serverEmailCode } from '../../src/services/email-proof-service/authSecrets';

const signIn = { name: 'Sign in with Google' };
const heading = { name: 'Confirm your email address' };
const field = (page: Page) => page.getByRole('textbox', { name: '8-digit code', exact: true });
const button = (page: Page, name: string) => page.getByRole('button', { name, exact: true });
const asked = (state: HostedState, path: string) =>
	state.calls.filter((call) => call.path.startsWith(path));

test('the email input follows the server code contract', async ({ page }) => {
	const proof = { ...unsent, sent: true, expiresAt: '2026-10-12T12:10:00.000Z' };
	await hostedFixture(page, { signedIn: false, email: { proof, delivery: true } });
	await page.goto('/');
	const code = serverEmailCode();
	expect(await field(page).getAttribute('maxlength')).toBe(String(code.length));
	await field(page).fill(code.slice(0, -1));
	await expect(button(page, 'Verify')).toBeDisabled();
	await field(page).fill(code);
	await expect(button(page, 'Verify')).toBeEnabled();
});

/** Signs in with a Google account whose address Google does not vouch for. */
async function thirdParty(page: Page) {
	const state = await hostedFixture(page, { signedIn: false });
	await page.goto('/');
	await page.evaluate(
		(value) => Object.assign(window, { __credential: value }),
		thirdPartyCredential
	);
	await page.getByRole('button', signIn).click();
	await expect(page.getByRole('heading', heading)).toBeVisible();
	return state;
}

test('another address is pending and reads no project until its code is verified', async ({
	page,
	browserErrors,
	baseURL
}) => {
	browserErrors.expectError({
		type: 'console',
		message: 'Failed to load resource: the server responded with a status of 400 (Bad Request)',
		source: new URL(`/api/auth/email/verify`, baseURL).href,
		reason: 'Deliberately submitting the wrong email code verifies rejection.'
	});
	const state = await thirdParty(page);
	await expect(page.getByText(ada.email).first()).toBeVisible();
	await expect(page.getByRole('button', signIn)).toHaveCount(0);
	await expect(page.getByRole('link', { name: 'Open Atlas', exact: true })).toHaveCount(0);
	await expect(field(page)).toBeDisabled();
	expect(asked(state, '/api/auth/email/')).toEqual([]);
	await button(page, 'Send code').click();
	await expect(button(page, 'Resend code')).toBeVisible();
	await expect(page.getByText(/A code was sent to/)).toBeVisible();
	await field(page).fill('11111111');
	await button(page, 'Verify').click();
	await expect(page.getByRole('alert')).toContainText(/not right or has expired/);
	await expect(field(page)).toHaveValue('11111111');
	expect(asked(state, '/api/projects')).toEqual([]);
	await field(page).fill(emailCode);
	await button(page, 'Verify').click();
	await page.getByRole('link', { name: 'Open Atlas', exact: true }).click();
	await expect(page.getByRole('heading', { name: 'Atlas activity', exact: true })).toBeVisible();
	const verified = asked(state, '/api/auth/email/verify');
	expect(verified.map((call) => [call.method, call.body, call.query])).toEqual([
		['POST', { code: '11111111' }, {}],
		['POST', { code: emailCode }, {}]
	]);
	const addresses = state.calls.map((call) => call.path + JSON.stringify(call.query));
	expect(addresses.filter((address) => address.includes(emailCode))).toEqual([]);
	expect(page.url()).not.toContain(emailCode);
	const stored = await page.evaluate(() =>
		JSON.stringify([{ ...localStorage }, { ...sessionStorage }])
	);
	expect(stored).not.toContain(emailCode);
});

test('cancel forgets the typed code and returns the Google button', async ({ page }) => {
	const state = await thirdParty(page);
	await button(page, 'Send code').click();
	await field(page).fill('1234');
	await expect(button(page, 'Verify')).toBeDisabled();
	await button(page, 'Cancel').click();
	await expect(page.getByRole('button', signIn)).toBeVisible();
	await expect(page.getByRole('heading', heading)).toHaveCount(0);
	await expect(page.getByRole('textbox')).toHaveCount(0);
	expect(asked(state, '/api/auth/logout')).toHaveLength(1);
	expect(state.email.proof).toBeNull();
	expect(asked(state, '/api/projects')).toEqual([]);
});

test('a pending address opens no project, member list or desktop approval', async ({ page }) => {
	const email = { proof: unsent, delivery: true };
	const state = await hostedFixture(page, { signedIn: false, email });
	for (const path of [
		`/projects/${atlas}/harness/pages`,
		`/projects/${atlas}/members`,
		'/native/handoff-1'
	]) {
		await page.goto(path);
		await expect(page.getByRole('heading', heading)).toBeVisible();
		await expect(page.getByRole('button', signIn)).toHaveCount(0);
	}
	expect(asked(state, '/api/projects')).toEqual([]);
	expect(asked(state, '/api/auth/native')).toEqual([]);
	expect(asked(state, '/api/auth/email/')).toEqual([]);
});

test('a deployment that cannot send email says so and marks nothing as sent', async ({
	page,
	browserErrors,
	baseURL
}) => {
	browserErrors.expectError({
		type: 'console',
		message:
			'Failed to load resource: the server responded with a status of 503 (Service Unavailable)',
		source: new URL(`/api/auth/email/start`, baseURL).href,
		reason: 'Deliberately disabled email delivery verifies the unavailable state.'
	});
	const email = { proof: unsent, delivery: false };
	await hostedFixture(page, { signedIn: false, email });
	await page.goto('/');
	await button(page, 'Send code').click();
	await expect(page.getByRole('alert')).toContainText(/cannot send email yet/);
	await expect(button(page, 'Send code')).toBeVisible();
	await expect(page.getByText(/A code was sent to/)).toHaveCount(0);
	await expect(field(page)).toBeDisabled();
});
