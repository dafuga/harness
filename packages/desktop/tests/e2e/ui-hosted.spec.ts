import type { Call, Event } from './ui-hosted.spec.types';
import { expect, test, type Page } from '../../../../test/support/browserTest';
import {
	alpha,
	captureHostedSignIn,
	captureSignedInHome,
	gamma,
	hostedFixture,
	tip,
	userCode,
	verificationUrl
} from './ui-hosted-fixture';
const calls = (page: Page) =>
	page.evaluate(() => (window as unknown as { __calls: Call[] }).__calls);
const made = async (page: Page, op: string) => (await calls(page)).filter((call) => call.op === op);
const cache = (page: Page, event: Event) =>
	page.evaluate(
		(value) => (window as unknown as { __cache: (e: Event) => void }).__cache(value),
		event
	);
const hosted = (page: Page) =>
	page.evaluate(
		() => (window as unknown as { __hosted: { state: string; polls: number } }).__hosted
	);
const message = (page: Page) => page.getByRole('textbox', { name: 'Message', exact: true });
const entity = (project: string, branch: string, rest = '') =>
	`/projects/${project}/harness/branch/${branch}/pages/page%3Aactivity${rest}`;
const saved = '2026-10-12T08:00:00.000Z';

test('desktop Google sign-in gates direct links and lands on Home', async ({ page }) => {
	await hostedFixture(page, 'signed-out');
	await page.goto('/settings');
	const google = page.getByRole('button', { name: 'Sign in with Google' });
	await expect(google).toBeVisible();
	await expect(page.getByRole('heading', { name: 'Settings' })).toHaveCount(0);
	expect(await made(page, 'listProjects')).toEqual([]);
	await captureHostedSignIn(page);
	await google.click();
	await expect(page.getByRole('status')).toHaveText('Waiting for Google…');
	await expect(page.getByText(userCode, { exact: true })).toHaveCount(0);
	await page.getByRole('button', { name: 'Cancel', exact: true }).click();
	await expect(google).toBeVisible();
	await google.click();
	await expect(page.getByRole('status')).toHaveText('Waiting for Google…');
	await page.evaluate(() => {
		(window as unknown as { __hosted: { state: string } }).__hosted.state = 'signed-in';
	});
	await expect(page).toHaveURL(/\/$/, { timeout: 15000 });
	await expect(page.getByRole('button', { name: 'Open Gamma', exact: true })).toBeVisible();
	const projects = page.getByRole('region', { name: 'Projects', exact: true });
	await captureSignedInHome(page);
	await expect(projects.getByText('2 need you')).toBeVisible();
	await expect(
		page.getByRole('region', { name: 'Blocked - needs you' }).getByText('Review the launch plan')
	).toBeVisible();
	await expect(page.getByRole('link', { name: 'Needs you', exact: true })).toBeVisible();
	await expect(page.getByRole('heading', { name: 'Harness', exact: true })).toHaveCount(0);
	await projects.getByRole('button', { name: 'Open Gamma', exact: true }).click();
	await expect(page).toHaveURL(new RegExp(`/projects/${gamma}/harness/`));
	await page.getByRole('link', { name: 'Needs you', exact: true }).click();
	await expect(page).toHaveURL(/\?view=needs-you$/);
	await expect(page.getByRole('heading', { name: 'Needs you', exact: true })).toBeVisible();
	await expect(page.getByText('Review the launch plan')).toBeVisible();
	await expect(projects).toHaveCount(0);
	await page.getByRole('link', { name: 'Home', exact: true }).click();
	await projects.getByRole('link', { name: 'Open Tracker Orion' }).click();
	await expect(page).toHaveURL(/\/tracker\?project=Tracker\+Orion$/);
	await expect(page.getByRole('heading', { name: 'Tracker Orion', exact: true })).toBeVisible();
	await expect(page.getByText('Orion task')).toBeVisible();
	await expect(page.getByText('Unrelated task')).toHaveCount(0);
	await page.evaluate(() => sessionStorage.setItem('fixtureHubUnavailable', 'yes'));
	await page.goto('/');
	await expect(projects.getByText('Hub projects could not be loaded.')).toBeVisible();
	await expect(projects.getByRole('button', { name: 'Open Alpha', exact: true })).toBeVisible();
	await expect(projects.getByRole('link', { name: 'Open Tracker Orion' })).toBeVisible();
	await page.getByRole('button', { name: 'Account', exact: true }).click();
	await page.getByRole('button', { name: 'Sign out', exact: true }).click();
	await expect(google).toBeVisible();
	await expect(page.getByRole('button', { name: 'Open Alpha', exact: true })).toHaveCount(0);
});

test('signed-in Home lists personal reminders and Needs you leaves them out', async ({ page }) => {
	await hostedFixture(page);
	await page.goto('/');
	const reminders = page.getByRole('region', { name: 'Reminders', exact: true });
	await expect(reminders.getByRole('listitem')).toContainText(/Water the sample plant\s*Due now/);
	await page.getByRole('link', { name: 'Needs you', exact: true }).click();
	await expect(page.getByText('Review the launch plan')).toBeVisible();
	await expect(reminders).toHaveCount(0);
});

test('typed-code recovery displays the code and polls at the Hub interval', async ({ page }) => {
	await hostedFixture(page, 'signed-out');
	await page.goto('/');
	await page.getByRole('button', { name: 'Use a one-time code' }).click();
	await expect(page.getByText(userCode, { exact: true })).toBeVisible();
	await expect(page.getByText(verificationUrl, { exact: true })).toBeVisible();
	expect(page.url()).not.toContain(userCode);
	const before = (await hosted(page)).polls;
	await page.waitForTimeout(2500);
	const asked = (await hosted(page)).polls - before;
	expect(asked).toBeGreaterThanOrEqual(2);
	expect(asked).toBeLessThanOrEqual(3);
	await page.evaluate(() => {
		(window as unknown as { __hosted: { state: string } }).__hosted.state = 'signed-in';
	});
	await expect(page.getByRole('button', { name: 'Open Gamma', exact: true })).toBeVisible();
	await expect(page.getByText(userCode, { exact: true })).toHaveCount(0);
});

test('an offline event makes the shown shared project read-only before anything else changes', async ({
	page
}) => {
	await hostedFixture(page);
	await page.goto(entity(gamma, 'main', '/designs'));
	await expect(message(page)).toBeEnabled();
	await cache(page, { projectId: alpha, status: 'offline', cachedAt: saved });
	await expect(message(page)).toBeEnabled();
	await cache(page, { projectId: gamma, status: 'offline', cachedAt: saved });
	const footer = page.getByRole('contentinfo');
	await expect(footer.getByText('Offline cached view', { exact: true })).toBeVisible();
	await expect(
		footer.getByText(/Read-only · saved .* · not checked with the server/)
	).toBeVisible();
	await expect(message(page)).toBeDisabled();
	await expect(page.getByText(/Comments and changes need a connection/)).toBeVisible();
	await expect(page.getByRole('button', { name: 'Comment on image', exact: true })).toBeDisabled();
	await expect(
		page.getByRole('img', { name: 'Gamma activity v001 desktop default' })
	).toBeVisible();
	await cache(page, { projectId: gamma, status: 'fresh' });
	await expect(message(page)).toBeDisabled();
	expect(await made(page, 'addComment')).toEqual([]);
});

test('a refused source read clears the whole shared view, and nothing late brings it back', async ({
	page
}) => {
	await hostedFixture(page);
	await page.goto(entity(gamma, 'main'));
	await page
		.getByRole('navigation', { name: 'Entity sections' })
		.getByRole('button', { name: 'Source', exact: true })
		.click();
	await page.evaluate(() => Object.assign(window, { __deny: true }));
	await page.getByRole('button', { name: 'src/activity.svelte', exact: true }).click();
	await expect(page.getByRole('alert')).toContainText('Access to this shared project ended');
	await expect(page.getByRole('button', { name: 'Open project', exact: true })).toBeVisible();
	await expect(page.getByText(/Gamma activity/)).toHaveCount(0);
	await expect(page.locator('.image-canvas')).toHaveCount(0);
	await expect(page.getByRole('complementary', { name: 'Design conversation' })).toHaveCount(0);
	await cache(page, { projectId: gamma, status: 'fresh' });
	await page.waitForTimeout(400);
	await expect(page.getByText(/Gamma activity/)).toHaveCount(0);
	await expect(page.getByRole('button', { name: 'Open Gamma', exact: true })).toBeVisible();
	await cache(page, { projectId: '$projects', status: 'denied' });
	await expect(page.getByRole('button', { name: 'Open Gamma', exact: true })).toHaveCount(0);
	await page.getByRole('button', { name: 'Open Alpha', exact: true }).click();
	await expect(page.getByRole('heading', { name: 'Alpha activity', exact: true })).toBeVisible();
	await cache(page, { projectId: '$projects', status: 'denied' });
	await cache(page, { projectId: alpha, status: 'denied' });
	await expect(page.getByRole('heading', { name: 'Alpha activity', exact: true })).toBeVisible();
	await expect(page.getByRole('alert')).toHaveCount(0);
});

test('history loads further pages for the shown branch and commit, and comments carry their author', async ({
	page
}) => {
	await hostedFixture(page);
	await page.goto(entity(gamma, 'main', '/history'));
	const history = page.getByRole('main');
	await expect(history.getByText('First page event A', { exact: true })).toBeVisible();
	const more = page.getByRole('button', { name: 'Load more history', exact: true });
	await more.click();
	await expect(history.getByText('Second page event C', { exact: true })).toBeVisible();
	await expect(history.getByText('First page event B', { exact: true })).toHaveCount(1);
	await more.click();
	await expect(history.getByText('Third page event D', { exact: true })).toBeVisible();
	await expect(more).toHaveCount(0);
	const asked = { projectId: gamma, entityId: 'page:activity', commit: tip, branch: 'main' };
	expect(await made(page, 'history')).toMatchObject([
		{ ...asked, page: 2 },
		{ ...asked, page: 3 }
	]);
	await page.getByRole('button', { name: 'Designs', exact: true }).click();
	await page.getByRole('button', { name: 'Comment on image', exact: true }).click();
	await message(page).fill('Looks right');
	await page.getByRole('button', { name: 'Send comment', exact: true }).click();
	const thread = page.getByRole('complementary', { name: 'Design conversation' });
	await expect(thread.getByText('Ada Example', { exact: true })).toBeVisible();
	await expect(thread.getByText('You', { exact: true })).toHaveCount(0);
	await page.goto(entity(alpha, 'feat%2Falpha', '/history'));
	await expect(page.getByRole('heading', { name: 'Entity history', exact: true })).toBeVisible();
	await expect(more).toHaveCount(0);
	await expect(page.getByText('Earlier history is not loaded here.')).toHaveCount(0);
});
