import { expect, test, type Page, type TestInfo } from '../../../../test/support/browserTest';
import { SealedEnrollmentReviewService } from '../../../remote/src/services/networking-security/SealedEnrollmentReviewService';
import { chainEntryHash } from '../../../remote/src/utils/networking-security/sealedChainEntry';
import { readSealedDeviceSession } from '../../../remote/src/utils/networking-security/readSealedDeviceSession';
import { bootstrapCandidate } from '../../test/support/syncBootstrapCandidate';
import { startSync } from '../../test/support/syncFixture';
import { hostedFixture, ada, clientId } from './hosted-fixture';
import { pushAddress, pushBrowser } from './hub-web-push-fixture';
import { captureDeviceApproval, shown } from './hub-web-push-page';

test.use({ channel: 'chromium' });
const account = 'google:fixture-a';
const admin = 'session-a';
const browser = 'session-a-browser';
const requester = 'session-a-secondary';
const returning = 'session-a-browser-returning';
const googleButton = { name: 'Sign in with Google' };
const home = '[data-harness-component="hub-home"]';
const waiting = { name: 'Waiting for approval' };
async function startBrowser(page: Page, origin: string, sessions: string[]) {
	const identity = { ...ada, id: account };
	const state = await hostedFixture(page, { actor: identity, signedIn: false });
	await page.route('**/api/auth/status', (route) =>
		route.fulfill({
			json: {
				actor: state.signedIn ? identity : null,
				configured: true,
				clientId,
				deviceApproval: state.signedIn
			}
		})
	);
	await page.route('**/api/hub-home', (route) =>
		route.fulfill({ json: { agents: [], plans: [], scheduled: [], quota: [] } })
	);
	await page.route('**/api/push', (route) => route.fulfill({ json: { available: false } }));
	const installations = new Set<string>();
	const decisions = { count: 0 };
	await page.route('**/api/sync/v1/**', async (route) => {
		const request = route.request();
		const url = new URL(request.url());
		const device = request.headers()['x-harness-device'];
		installations.add(device);
		if (url.pathname.endsWith('/devices') && request.method() === 'POST') decisions.count++;
		const signOuts = state.calls.filter(({ path }) => path === '/api/auth/logout').length;
		const reply = await fetch(origin + url.pathname + url.search, {
			method: request.method(),
			headers: {
				'X-Test-Session': sessions[signOuts],
				'X-Harness-Device': device,
				'Content-Type': 'application/json'
			},
			body: request.postData() ?? undefined
		});
		await route.fulfill({ status: reply.status, json: await reply.json() });
	});
	await page.goto('/');
	await page.getByRole('button', googleButton).click();
	return { installations, state, decisions };
}

async function admitBrowser(
	fixture: Awaited<ReturnType<typeof startSync>>,
	page: Page,
	testInfo: TestInfo
) {
	const candidate = await bootstrapCandidate(account);
	expect((await fixture.call(admin, 'POST', 'bootstrap', candidate)).status).toBe(201);
	const adminRequest = (path: string, init: RequestInit) =>
		fetch(fixture.origin + path, {
			...init,
			headers: { ...init.headers, 'X-Test-Session': admin }
		});
	expect(await readSealedDeviceSession(adminRequest, candidate.admin)).toBe('approved');
	const entered = await startBrowser(page, fixture.origin, [browser]);
	const waitingHeading = page.getByRole('heading', waiting);
	await expect(waitingHeading.or(page.locator(home))).toBeVisible();
	await captureDeviceApproval(page, testInfo, 'waiting');
	await expect(waitingHeading).toBeVisible();
	await expect(page.locator(home)).toHaveCount(0);
	expect(entered.state.calls.some((call) => call.path === '/api/projects')).toBe(false);
	const inbox = async () =>
		(await (await fixture.call(admin, 'GET', 'enroll', { headers: candidate.headers })).json()) as {
			requests: { id: string }[];
		};
	await expect.poll(async () => (await inbox()).requests.length).toBe(1);
	const [{ id }] = (await inbox()).requests;
	await page.reload();
	await expect(waitingHeading).toBeVisible({ timeout: 15_000 });
	expect((await inbox()).requests.map((item) => item.id)).toEqual([id]);
	expect(entered.installations.size).toBe(1);
	const review = new SealedEnrollmentReviewService(
		{
			account,
			device: candidate.admin,
			signal: new AbortController().signal,
			request: adminRequest,
			pin: { seq: 0, head: await chainEntryHash(candidate.body.entry) }
		},
		id
	);
	await review.claim();
	await expect.poll(() => review.comparison()).toMatch(/^\d{6}$/);
	const code = (await review.comparison())!;
	await expect(page.getByText(code, { exact: true })).toBeVisible();
	expect(await review.approve(code, async () => true)).not.toBeNull();
	await expect(page.locator(home)).toBeVisible();
	return entered.decisions;
}

async function decideFromBrowser(
	page: Page,
	target: Page,
	testInfo: TestInfo,
	decisions: { count: number }
) {
	const inbox = page.getByRole('region', { name: 'Device approvals' });
	const review = inbox.getByRole('button', { name: 'Review Harness Hub' });
	await captureDeviceApproval(page, testInfo, 'inbox');
	await expect(review).toBeVisible({ timeout: 19_000 });
	await expect
		.poll(() => shown(page, '/device-approval-notifications/'))
		.toEqual([
			{
				title: 'Harness',
				body: 'A device sign-in is ready for review.',
				tag: 'harness-device-approval',
				data: null
			}
		]);
	await captureDeviceApproval(page, testInfo, 'inbox');
	await review.click();
	const dialog = page.getByRole('dialog', { name: 'Approve Harness Hub' });
	const code = await dialog.getByText(/^\d{6}$/).textContent();
	await expect(target.getByText(code!, { exact: true })).toBeVisible();
	await captureDeviceApproval(page, testInfo, 'compare');
	const approve = dialog.getByRole('button', { name: 'Approve device' });
	await approve.dispatchEvent('click');
	await expect(dialog.getByRole('alert')).toHaveText(
		'Could not complete this decision. Try again.'
	);
	expect(decisions.count).toBe(0);
	await approve.click();
	await expect(page.getByText('Device approved.', { exact: true })).toBeVisible();
	await expect(target.locator(home)).toBeVisible();
	await captureDeviceApproval(page, testInfo, 'approved');
	expect(decisions.count).toBe(1);
}

test('each Hub browser sign-in waits for a verified device approval, including after sign-out', async ({
	page,
	browser: chromium,
	baseURL,
	browserErrors
}, testInfo) => {
	test.setTimeout(90_000);
	const fixture = await startSync();
	const context = await chromium.newContext({ baseURL });
	browserErrors.watch(context);
	try {
		await fixture.db.batch(
			[admin, browser, requester, returning].map((session) =>
				fixture.db
					.prepare(
						`INSERT INTO auth_sessions
					(id_hash, kind, actor_id, actor_email, actor_name, resource, created_at, expires_at)
					VALUES (?, ?, ?, 'test@example.test', 'Test', 'projects', 1, ?)`
					)
					.bind(
						'test-' + session,
						session === admin ? 'native' : 'browser',
						account,
						Date.now() + 180_000
					)
			)
		);
		await page.context().grantPermissions(['notifications']);
		await pushBrowser(page, { permission: 'default' });
		const decisions = await admitBrowser(fixture, page, testInfo);
		const enable = page.getByRole('button', { name: 'Turn on notifications' });
		try {
			await expect(enable).toBeVisible({ timeout: 4000 });
		} finally {
			await captureDeviceApproval(page, testInfo, 'approval-push-off');
		}
		await enable.click();
		await expect(page.getByText('Device approval notifications on')).toBeVisible();
		expect(
			await fixture.db
				.prepare('SELECT endpoint FROM approval_web_push WHERE account = ?')
				.bind(account)
				.first('endpoint')
		).toBe(pushAddress);
		await captureDeviceApproval(page, testInfo, 'approval-push-on');
		const target = await context.newPage();
		const entered = await startBrowser(target, fixture.origin, [requester, returning]);
		await expect(target.getByRole('heading', waiting)).toBeVisible({ timeout: 15_000 });
		await page.bringToFront();
		await decideFromBrowser(page, target, testInfo, decisions);
		await target.reload();
		await expect(target.locator(home)).toBeVisible();
		expect(entered.installations.size).toBe(1);
		await target.getByRole('button', { name: 'Account', exact: true }).click();
		await target.getByRole('button', { name: 'Sign out', exact: true }).click();
		await target.getByRole('button', googleButton).click();
		await expect(target.getByRole('heading', waiting)).toBeVisible({ timeout: 15_000 });
		expect(entered.installations.size).toBe(2);
		await expect(target.locator(home)).toHaveCount(0);
		await page.bringToFront();
		const deny = page.getByRole('button', { name: 'Deny Harness Hub' });
		await deny.click({ timeout: 19_000 });
		await expect(page.getByText('Device denied.', { exact: true })).toBeVisible();
		await expect(target.getByRole('heading', { name: 'Device approval denied' })).toBeVisible();
		await captureDeviceApproval(page, testInfo, 'denied');
	} finally {
		await context.close();
		await fixture.stop();
	}
});
