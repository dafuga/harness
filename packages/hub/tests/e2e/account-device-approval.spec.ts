import { expect, test } from '../../../../test/support/browserTest';
import { SealedEnrollmentReviewService } from '../../../remote/src/services/networking-security/SealedEnrollmentReviewService';
import { chainEntryHash } from '../../../remote/src/utils/networking-security/sealedChainEntry';
import { readSealedDeviceSession } from '../../../remote/src/utils/networking-security/readSealedDeviceSession';
import { bootstrapCandidate } from '../../test/support/syncBootstrapCandidate';
import { startSync } from '../../test/support/syncFixture';
import { hostedFixture, ada, clientId } from './hosted-fixture';

const account = 'google:fixture-a';
const browser = 'session-a-browser';
const admin = 'session-a';
const googleButton = { name: 'Sign in with Google' };

test('Google sign-in keeps the browser waiting across reload until the signed approval arrives', async ({
	page
}, testInfo) => {
	const fixture = await startSync();
	try {
		await fixture.db.batch(
			[admin, browser].map((session) =>
				fixture.db
					.prepare(
						`INSERT INTO auth_sessions
					(id_hash, kind, actor_id, actor_email, actor_name, resource, created_at, expires_at)
					VALUES (?, ?, ?, 'test@example.test', 'Test', 'projects', 1, ?)`
					)
					.bind(
						'test-' + session,
						session === browser ? 'browser' : 'native',
						account,
						Date.now() + 120_000
					)
			)
		);
		const candidate = await bootstrapCandidate(account);
		expect((await fixture.call(admin, 'POST', 'bootstrap', candidate)).status).toBe(201);
		const adminRequest = (path: string, init: RequestInit) =>
			fetch(fixture.origin + path, {
				...init,
				headers: { ...init.headers, 'X-Test-Session': admin }
			});
		expect(await readSealedDeviceSession(adminRequest, candidate.admin)).toBe('approved');
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
		const installations = new Set<string>();
		await page.route('**/api/sync/v1/**', async (route) => {
			const request = route.request();
			const url = new URL(request.url());
			const device = request.headers()['x-harness-device'];
			installations.add(device);
			const reply = await fetch(fixture.origin + url.pathname + url.search, {
				method: request.method(),
				headers: {
					'X-Test-Session': browser,
					'X-Harness-Device': device,
					'Content-Type': 'application/json'
				},
				body: request.postData() ?? undefined
			});
			await route.fulfill({ status: reply.status, json: await reply.json() });
		});
		await page.goto('/');
		await page.getByRole('button', googleButton).click();
		const waiting = page.getByRole('heading', { name: 'Waiting for approval' });
		const home = page.locator('[data-harness-component="hub-home"]');
		await expect(waiting.or(home)).toBeVisible();
		if (process.env.TAKE_SCREENSHOT === 'true') {
			for (const width of [390, 768, 1440]) {
				await page.setViewportSize({ width, height: 900 });
				await page.evaluate(() => document.fonts.ready);
				await page.screenshot({ path: testInfo.outputPath(`hub-device-approval-${width}.png`) });
			}
		}
		await expect(waiting).toBeVisible({ timeout: 5000 });
		await expect(home).toHaveCount(0);
		expect(state.calls.some((call) => call.path === '/api/projects')).toBe(false);
		const inbox = async () =>
			(await (
				await fixture.call(admin, 'GET', 'enroll', { headers: candidate.headers })
			).json()) as { requests: { id: string }[] };
		await expect.poll(async () => (await inbox()).requests.length).toBe(1);
		const [{ id }] = (await inbox()).requests;
		await page.reload();
		await expect(waiting).toBeVisible();
		expect((await inbox()).requests.map((item) => item.id)).toEqual([id]);
		expect(installations.size).toBe(1);
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
		await expect(home).toBeVisible();
		await expect(waiting).toHaveCount(0);
	} finally {
		await fixture.stop();
	}
});
