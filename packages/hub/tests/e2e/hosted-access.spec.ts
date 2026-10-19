import { expect, test } from '../../../../test/support/browserTest';
import { atlas, clientId, code, credential, hostedFixture, invitation } from './hosted-fixture';

const signIn = { name: 'Sign in with Google' };

test('without configured sign-in the page says so and offers no login', async ({ page }) => {
	const state = await hostedFixture(page, { configured: false, signedIn: false });
	await page.goto('/');
	await expect(page.getByRole('heading', { name: 'Sign-in is not configured' })).toBeVisible();
	await expect(page.getByText(/Google client ID\s+and a session secret/)).toBeVisible();
	await expect(page.getByRole('button', signIn)).toHaveCount(0);
	await expect(page.getByRole('textbox')).toHaveCount(0);
	expect(state.google).toEqual([]);
	expect(state.calls.map((call) => call.path)).toEqual(['/api/auth/status']);
});

test('Google sign-in uses the challenge nonce and posts the credential in a body', async ({
	page
}) => {
	const state = await hostedFixture(page, { signedIn: false });
	await page.goto('/');
	await page.getByRole('button', signIn).click();
	await expect(page.getByRole('link', { name: 'Open Atlas', exact: true })).toBeVisible();
	await expect(page.getByText('Ada Example', { exact: true })).toBeVisible();
	expect(state.google).toEqual(['https://accounts.google.com/gsi/client']);
	const options = await page.evaluate(() => (window as unknown as { __gis: object }).__gis);
	expect(options).toMatchObject({ client_id: clientId, nonce: 'nonce-1' });
	const posted = state.calls.find((call) => call.path === '/api/auth/google');
	expect(posted).toMatchObject({ method: 'POST', body: { credential, csrf: 'csrf-1' }, query: {} });
	expect(state.calls.filter((call) => JSON.stringify(call.query).includes(credential))).toEqual([]);
	expect(page.url()).not.toContain(credential);
	await page.getByRole('button', { name: 'Sign out', exact: true }).click();
	await expect(page.getByRole('button', signIn)).toBeVisible();
	await expect(page.getByRole('link', { name: 'Open Atlas', exact: true })).toHaveCount(0);
});

test('signed in without projects, the page explains how a project appears', async ({ page }) => {
	const github = { configured: true, connected: false, login: null };
	await hostedFixture(page, { empty: true, github });
	await page.goto('/');
	await expect(page.getByRole('heading', { name: 'No shared projects yet' })).toBeVisible();
	await expect(page.getByText(/invitation link\s+and its code/)).toBeVisible();
	await expect(page.getByRole('link', { name: 'Connect GitHub', exact: true })).toHaveAttribute(
		'href',
		'/api/github/connect'
	);
	await expect(page.getByText(/The server checks that you\s+administer/)).toBeVisible();
	await expect(page.getByRole('button', { name: 'Create project', exact: true })).toHaveCount(0);
});

test('a project is created from a repository the server listed', async ({ page }) => {
	const state = await hostedFixture(page);
	await page.goto('/');
	await page.getByLabel('Repository', { exact: true }).selectOption('42');
	await page.getByRole('textbox', { name: 'Project name', exact: true }).fill('Atlas docs');
	await page.getByRole('button', { name: 'Create project', exact: true }).click();
	await expect
		.poll(() => state.calls.find((call) => call.method === 'POST' && call.path === '/api/projects'))
		.toMatchObject({ body: { name: 'Atlas docs', repositoryId: 42 } });
	await expect(page.getByRole('spinbutton')).toHaveCount(0);
});

test('an owner invites by a link and a code that are shown apart, and no email is sent', async ({
	page
}) => {
	const state = await hostedFixture(page);
	await page.goto(`/projects/${atlas}/members`);
	await expect(page.getByRole('heading', { name: 'Members of Atlas' })).toBeVisible();
	await expect(page.getByRole('row', { name: /Ben Example/ })).toContainText('commenter');
	await page.getByRole('textbox', { name: 'Email', exact: true }).fill('cara@example.invalid');
	await page.getByLabel('Role', { exact: true }).selectOption('viewer');
	await page.getByRole('button', { name: 'Create invitation', exact: true }).click();
	const link = page.getByRole('textbox', { name: 'Invitation link', exact: true });
	const origin = new URL(page.url()).origin;
	await expect(link).toHaveValue(`${origin}/invite/${atlas}/${invitation}`);
	await expect(page.getByRole('textbox', { name: 'Invitation code', exact: true })).toHaveValue(
		code
	);
	await expect(link).not.toHaveValue(new RegExp(code));
	await expect(page.getByText(/Harness sends no email/)).toBeVisible();
	await expect(page.getByRole('button', { name: 'Copy link', exact: true })).toBeVisible();
	await expect(page.getByRole('button', { name: 'Copy code', exact: true })).toBeVisible();
	const posted = state.calls.find((call) => call.path.endsWith('/invitations'));
	expect(posted).toMatchObject({
		method: 'POST',
		body: { email: 'cara@example.invalid', role: 'viewer' }
	});
	expect(page.url()).not.toContain(code);
});

test('an invitation asks for sign-in and the code, then opens the project', async ({
	page,
	browserErrors,
	baseURL
}) => {
	browserErrors.expectError({
		type: 'console',
		message: 'Failed to load resource: the server responded with a status of 400 (Bad Request)',
		source: new URL(`/api/projects/${atlas}/invitations/${invitation}/accept`, baseURL).href,
		reason: 'Deliberately submitting an invalid invitation code verifies rejection.'
	});
	const state = await hostedFixture(page, { signedIn: false });
	await page.goto(`/invite/${atlas}/${invitation}`);
	await expect(page.getByRole('heading', { name: 'Join a shared project' })).toBeVisible();
	await expect(page.getByRole('textbox', { name: 'Invitation code', exact: true })).toHaveCount(0);
	await page.getByRole('button', signIn).click();
	const field = page.getByRole('textbox', { name: 'Invitation code', exact: true });
	await field.fill('wrong-code');
	await page.getByRole('button', { name: 'Join project', exact: true }).click();
	await expect(page.getByRole('alert')).toContainText(/not valid/);
	await field.fill(code);
	await page.getByRole('button', { name: 'Join project', exact: true }).click();
	await expect(page).toHaveURL(new RegExp(`/projects/${atlas}/harness/branch/main/pages$`));
	const accepted = state.calls.filter((call) => call.path.endsWith('/accept'));
	expect(accepted.map((call) => call.body)).toEqual([{ code: 'wrong-code' }, { code }]);
	expect(accepted[0].path).toBe(`/api/projects/${atlas}/invitations/${invitation}/accept`);
	expect(state.calls.filter((call) => JSON.stringify(call.query).includes(code))).toEqual([]);
});

test('the same Google account automatically discovers owned and joined projects on another open device', async ({
	page,
	browser,
	baseURL
}) => {
	const state = await hostedFixture(page);
	const joined = state.data.projects.pop()!;
	const context = await browser.newContext({ baseURL });
	try {
		const other = await context.newPage();
		const second = await hostedFixture(other, { data: state.data });
		await page.goto('/');
		await other.goto('/');
		await expect(other.getByRole('link', { name: 'Open Atlas', exact: true })).toBeVisible();
		state.data.projects.push(joined, {
			...state.data.projects[0],
			id: invitation,
			name: 'New owned project'
		});
		await other.evaluate(() => window.dispatchEvent(new Event('focus')));
		try {
			await expect(other.getByRole('link', { name: 'Open Borealis', exact: true })).toBeVisible();
		} finally {
			if (process.env.TAKE_SCREENSHOT === 'true') {
				await other.evaluate(() => document.fonts.ready);
				await other.screenshot({
					path: `/tmp/harness-google-project-sync-${process.env.SCREENSHOT_LABEL ?? 'proof'}.png`,
					fullPage: true
				});
			}
		}
		await expect(
			other.getByRole('link', { name: 'Open New owned project', exact: true })
		).toBeVisible();
		state.data.projects.splice(0, 1);
		await other.evaluate(() => window.dispatchEvent(new Event('focus')));
		await expect(other.getByRole('link', { name: 'Open Atlas', exact: true })).toHaveCount(0);
		second.signedIn = false;
		await other.evaluate(() => window.dispatchEvent(new Event('focus')));
		await expect(
			other.getByRole('heading', { name: 'Sign in to Harness', exact: true })
		).toBeVisible();
		await expect(other.getByRole('link', { name: 'Open Borealis', exact: true })).toHaveCount(0);
	} finally {
		await context.close();
	}
});

test('an account changed in another tab replaces the identity and never retains the previous projects', async ({
	page
}) => {
	const state = await hostedFixture(page);
	await page.goto('/');
	await expect(page.getByRole('link', { name: 'Open Atlas', exact: true })).toBeVisible();
	state.actor = {
		...state.actor,
		id: 'google:ben',
		name: 'Ben Example',
		email: 'ben@example.invalid'
	};
	state.data.projects = [];
	await page.evaluate(() => window.dispatchEvent(new Event('focus')));
	await expect(page.getByText('Ben Example', { exact: true })).toBeVisible();
	await expect(page.getByRole('link', { name: 'Open Atlas', exact: true })).toHaveCount(0);
	await expect(page.getByRole('link', { name: 'Open Borealis', exact: true })).toHaveCount(0);
});
