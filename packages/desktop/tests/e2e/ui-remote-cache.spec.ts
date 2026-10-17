import { expect, test, type Page, type TestInfo } from '../../../../test/support/browserTest';
import { alpha, reopenAway, remoteCacheFixture } from './ui-remote-cache-fixture';

type Call = Record<string, unknown>;
/** Screenshots are opt-in test output; they are never part of the source tree. */
const shot = async (page: Page, info: TestInfo, name: string) => {
	if (process.env.TAKE_SCREENSHOT === 'true')
		await page.screenshot({ path: info.outputPath(`${name}.png`) });
};
const made = async (page: Page, op: string) =>
	(await page.evaluate(() => (window as unknown as { __calls: Call[] }).__calls)).filter(
		(call) => call.op === op
	);
const loaded = (page: Page) =>
	page
		.getByRole('img', { name: 'Alpha activity v002 desktop default' })
		.evaluate((node: HTMLImageElement) => node.naturalWidth);
const fits = (page: Page) =>
	page.evaluate(() => document.documentElement.scrollWidth <= window.innerWidth);
const base = `/projects/${alpha}/harness/branch/feat%2Falpha`;

test.use({ viewport: { width: 390, height: 844 } });

test('a phone opened while its computer is away shows saved copies, dated and read-only', async ({
	page
}, testInfo) => {
	await remoteCacheFixture(page);
	await page.goto('/');
	await page.getByRole('button', { name: 'Open Alpha', exact: true }).click();
	await page.getByRole('link', { name: 'Review designs' }).click();
	await expect.poll(() => loaded(page)).not.toBe(0);
	await reopenAway(page);
	await shot(page, testInfo, 'cache-start');
	await expect(page.getByRole('heading', { level: 1, name: 'Alpha activity' })).toBeVisible();
	const footer = page.getByRole('contentinfo');
	await expect(footer.getByText('Offline cached view', { exact: true })).toBeVisible();
	await expect(
		footer.getByText(/Read-only · saved .* · not checked with the server/)
	).toBeVisible();
	await expect(footer.getByRole('region', { name: 'Computer connection' })).toContainText(
		'Computer offline'
	);
	await expect.poll(() => loaded(page)).not.toBe(0);
	await expect(page.getByRole('button', { name: 'Comment on image', exact: true })).toBeDisabled();
	await expect(page.getByLabel('Project', { exact: true })).toHaveValue(alpha);
	expect(await made(page, 'native.request')).toEqual([]);
	expect(await fits(page)).toBe(true);
	await shot(page, testInfo, 'cache-saved');
});

test('what was never read is not invented, and no change is offered from a saved copy', async ({
	page
}) => {
	await remoteCacheFixture(page);
	await page.goto('/');
	await page.getByRole('button', { name: 'Open Alpha', exact: true }).click();
	await page.getByRole('link', { name: 'Review designs' }).click();
	await expect.poll(() => loaded(page)).not.toBe(0);
	await reopenAway(page);
	await expect(page.getByRole('heading', { level: 1, name: 'Alpha activity' })).toBeVisible();
	await page.evaluate((path) => {
		history.pushState({}, '', path);
		dispatchEvent(new PopStateEvent('popstate'));
	}, `${base}/components/component%3Abutton`);
	await expect(page.getByRole('alert')).toContainText('The computer is offline');
	await expect(page.getByRole('heading', { level: 1, name: 'Alpha button' })).toHaveCount(0);
	await page.getByRole('button', { name: 'Conversation', exact: true }).click();
	await expect(page.getByRole('textbox', { name: 'Message', exact: true })).toBeDisabled();
	await expect(page.getByRole('group', { name: 'Request mode' })).toHaveCount(0);
	await expect(page.getByRole('button', { name: 'Plan', exact: true })).toHaveCount(0);
	const asked = (await made(page, 'native.request')).map((call) => call.method);
	const changes = ['addComment', 'createPlan', 'openThread', 'approve', 'startRun', 'cancelRun'];
	expect(asked.filter((method) => changes.includes(String(method)))).toEqual([]);
	expect(asked).toContain('entity');
});
