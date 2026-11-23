import type { Page, TestInfo } from '@playwright/test';
import { expect as baseExpect, test } from '../../../../test/support/browserTest';
import type { ScenarioManifest } from '../../../../src/core/unitTypes';
import { buildStamp } from '../../../../src/utils/buildStamp';
import {
	evidenceRequested,
	recordCapture
} from '../../../../src/utils/reports-media/record-capture/recordCapture';
import { pageWorkload } from '../../../desktop/tests/e2e/page-workload';
import scenario from '../../../../specification/scenarios/project-overview-hub-projects.json' with { type: 'json' };
import { ada, hostedFixture } from './hosted-fixture';
import { grace, overviewFixture, refusal, viewports, open } from './tracker-overview-fixture';
import type { Viewport } from './tracker-overview-fixture';

const expect = baseExpect.configure({ timeout: 25_000 });
test.setTimeout(90_000);

const forbidden = {
	status: 403,
	text: 'Forbidden',
	reason: 'The owner endpoint refuses a signed-in account that is not the owner, on purpose.'
};

const unavailable = {
	status: 503,
	text: 'Service Unavailable',
	reason: 'The owner endpoint answers 503 on purpose when no current snapshot exists.'
};

const overviewRoot =
	'[data-harness-component="projects-sessions-project-overview-project-overview"]';

const unavailableNotice =
	'The tracker could not be reached from this host, so no projects are shown.';

/** Records the compiled account surface, with synthetic credentials and tracker data only. */
async function attachShot(
	page: Page,
	testInfo: TestInfo,
	state: string,
	viewport: Viewport,
	evidence = 'account-screen'
) {
	await page.evaluate(async () => {
		await document.fonts.ready;
		await new Promise<void>((resolve) =>
			requestAnimationFrame(() => requestAnimationFrame(() => resolve()))
		);
	});
	const body = await page.screenshot({ animations: 'disabled', caret: 'hide', scale: 'css' });
	await testInfo.attach(`projects-${state}-${viewport.id}.png`, {
		body,
		contentType: 'image/png'
	});
	if (!evidenceRequested()) return;
	const stamp = await page.locator('meta[name="harness-build"]').getAttribute('content');
	const buildId = buildStamp(stamp ?? undefined);
	const revision = process.env.HARNESS_VERIFY_REVISION;
	if (!buildId || !revision) throw new Error('Project account captures need a stamped Hub build.');
	recordCapture(
		{
			evidence,
			kind: 'screenshot',
			state,
			viewport: viewport.id,
			file: `projects-${state}-${viewport.id}.png`,
			mediaType: 'image/png',
			provenance: 'actual-capture',
			server: { buildId, revision }
		},
		body
	);
	const workload = { state, name: 'account', viewport: viewport.id, buildId };
	await pageWorkload(page, scenario as ScenarioManifest, workload);
}

test('the owner sees the Project overview link on /projects and it opens the overview', async ({
	page
}) => {
	const { overview } = await overviewFixture(page, 'ready');
	await page.goto('/projects');
	await expect(page.getByRole('heading', { name: 'Shared projects' })).toBeVisible();
	await expect(page.getByText('synthetic-sync', { exact: true })).toBeVisible();
	await page.getByRole('link', { name: 'Project overview', exact: true }).click();
	await expect(page).toHaveURL(/\/tracker-overview$/);
	expect(overview.calls.length).toBeGreaterThan(0);
	expect(overview.calls.every((call) => call.method === 'GET')).toBe(true);
	expect(overview.calls.every((call) => call.path === '/api/tracker-overview')).toBe(true);
	expect(overview.calls.every((call) => call.query === '')).toBe(true);
});

test('the signed-in Projects link on /tracker-overview opens the /projects dashboard', async ({
	page
}) => {
	await overviewFixture(page, 'ready');
	await page.goto('/tracker-overview');
	const projects = page.getByRole('link', { name: 'Projects', exact: true });
	await expect(projects).toBeVisible();
	await projects.click();
	await expect(page).toHaveURL(/\/projects$/);
	await expect(page.getByRole('heading', { name: 'Shared projects' })).toBeVisible();
});

test('an unavailable owner read still offers the link on /projects', async ({
	page,
	browserErrors,
	baseURL
}) => {
	refusal(browserErrors, baseURL!, unavailable);
	await overviewFixture(page, 'unavailable');
	await page.goto('/projects');
	await expect(page.getByRole('link', { name: 'Project overview', exact: true })).toBeVisible();
	await expect(page.getByText(unavailableNotice)).toBeVisible();
	await expect(page.getByText('synthetic-sync', { exact: true })).toHaveCount(0);
});

test('a signed-in non-owner sees the project list and no overview link on /projects', async ({
	page,
	browserErrors,
	baseURL
}) => {
	refusal(browserErrors, baseURL!, forbidden);
	await overviewFixture(page, 'ready', {
		actor: grace,
		github: { configured: false, connected: false, login: null }
	});
	const refused = page.waitForResponse(
		(response) =>
			new URL(response.url()).pathname === '/api/tracker-overview' && response.status() === 403
	);
	await page.goto('/projects');
	await (await refused).finished();
	await expect(page.getByRole('heading', { name: 'Shared projects' })).toBeVisible();
	await expect(page.getByText('Project creation isn’t set up yet.')).toBeVisible();
	await expect(page.getByRole('link', { name: 'Connect GitHub' })).toHaveCount(0);
	await expect(page.getByRole('link', { name: 'Project overview', exact: true })).toHaveCount(0);
	await expect(page.locator(overviewRoot)).toHaveCount(0);
	await expect(page.getByText('synthetic-sync', { exact: true })).toHaveCount(0);
});

test('signed-out /projects shows Google sign-in and reads no owner endpoint', async ({ page }) => {
	const { overview } = await overviewFixture(page, 'ready', { signedIn: false });
	await page.goto('/projects');
	await expect(page.getByRole('button', { name: 'Sign in with Google' })).toBeVisible();
	await expect(page.getByRole('link', { name: 'Project overview', exact: true })).toHaveCount(0);
	expect(overview.calls).toEqual([]);
});

test('switching accounts clears the owner link on /projects', async ({
	page,
	browserErrors,
	baseURL
}) => {
	refusal(browserErrors, baseURL!, {
		...forbidden,
		reason: 'After the account switch the owner endpoint refuses the other account on purpose.'
	});
	const { state } = await overviewFixture(page, 'ready');
	await open(page, viewports[0], '/projects');
	await expect(page.getByRole('link', { name: 'Project overview', exact: true })).toBeVisible();
	await expect(page.getByText('synthetic-sync', { exact: true })).toBeVisible();
	state.actor = grace;
	await page.evaluate(() => window.dispatchEvent(new Event('focus')));
	await expect(page.getByRole('link', { name: 'Project overview', exact: true })).toHaveCount(0);
	await expect(page.locator(overviewRoot)).toHaveCount(0);
	await expect(page.getByText('synthetic-sync', { exact: true })).toHaveCount(0);
	await expect(page.getByText(ada.name)).toHaveCount(0);
});

test('the verified GitHub callback status appears on the projects page', async ({
	page
}, testInfo) => {
	await overviewFixture(page);
	await open(page, viewports[0], '/projects?github=connected');
	const confirmation = page.getByText('GitHub is connected.', { exact: true });
	await confirmation.scrollIntoViewIfNeeded();
	await expect(confirmation).toBeInViewport();
	await attachShot(page, testInfo, 'github-connected', viewports[0], 'github-result');
});

for (const viewport of viewports) {
	test(`owner /projects settles at ${viewport.id}`, async ({ page }, testInfo) => {
		await overviewFixture(page, 'ready');
		await open(page, viewport, '/projects');
		await expect(page.getByRole('link', { name: 'Project overview', exact: true })).toBeVisible();
		await expect(page.locator(overviewRoot)).toBeVisible();
		await expect(page.getByText('synthetic-sync', { exact: true })).toBeVisible();
		const fit = await page.evaluate(() => ({
			documentOverflow: document.documentElement.scrollWidth - document.documentElement.clientWidth,
			offscreenCards: [...document.querySelectorAll('.po-card')].filter((card) => {
				const { left, right } = card.getBoundingClientRect();
				return left < 0 || right > innerWidth;
			}).length
		}));
		expect(fit).toEqual({ documentOverflow: 0, offscreenCards: 0 });
		await attachShot(page, testInfo, 'owner', viewport);
	});

	test(`non-owner /projects settles at ${viewport.id}`, async ({
		page,
		browserErrors,
		baseURL
	}, testInfo) => {
		refusal(browserErrors, baseURL!, forbidden);
		browserErrors.expectError({
			type: 'console',
			message:
				'Failed to load resource: the server responded with a status of 503 (Service Unavailable)',
			source: new URL('/api/projects', baseURL!).href,
			reason: 'Shared collaboration is intentionally disabled in this setup state.'
		});
		await overviewFixture(page, 'ready', {
			actor: grace,
			github: { configured: false, connected: false, login: null }
		});
		await page.route('**/api/projects', (route) =>
			route.fulfill({ status: 503, json: { error: 'collaboration-disabled' } })
		);
		const denied = page.waitForResponse(
			(response) =>
				new URL(response.url()).pathname === '/api/tracker-overview' && response.status() === 403
		);
		await open(page, viewport, '/projects');
		await (await denied).finished();
		await expect(page.getByRole('heading', { name: 'Shared projects' })).toBeVisible();
		await expect(page.getByRole('link', { name: 'Project overview', exact: true })).toHaveCount(0);
		await expect(page.locator(overviewRoot)).toHaveCount(0);
		await expect(page.getByText('Shared projects aren’t set up yet.')).toBeVisible();
		await expect(page.getByRole('heading', { name: 'New shared project' })).toHaveCount(0);
		await expect(
			page.getByText(/BrowserApiRequestError|configured for this deployment/)
		).toHaveCount(0);
		await attachShot(page, testInfo, 'non-owner', viewport);
	});

	test(`signed-out /projects settles at ${viewport.id}`, async ({ page }, testInfo) => {
		await hostedFixture(page, { signedIn: false });
		await open(page, viewport, '/projects');
		await expect(page.getByRole('button', { name: 'Sign in with Google' })).toBeVisible();
		await attachShot(page, testInfo, 'signed-out', viewport);
	});
}
