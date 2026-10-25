import { expect, test, type Page } from '../../../../test/support/browserTest';
import { catalogCategories } from './ui-workspace-fixture';
import { remoteEvidence } from './remote-evidence';
import { phone, remoteHostFixture } from './ui-remote-host-fixture';
import { alpha, hostName, remotePhoneFixture } from './ui-remote-phone-fixture';

/** Layout acceptance at a tablet width; the connection flows themselves are in the other specs. */
const fits = (page: Page) =>
	page.evaluate(() => document.documentElement.scrollWidth <= window.innerWidth);
const inside = async (page: Page, name: string) => {
	const box = await page.getByRole('region', { name }).boundingBox();
	const width = page.viewportSize()!.width;
	return Boolean(box) && box!.x >= 0 && box!.x + box!.width <= width;
};

test.use({ viewport: { width: 820, height: 1180 } });

test('a tablet-wide phone shell keeps the shared workspace and its connection in view', async ({
	page
}, testInfo) => {
	await remotePhoneFixture(page, 'online');
	await page.goto(`/projects/${alpha}/harness/branch/feat%2Falpha/pages/page%3Aactivity`);
	await expect(page.getByRole('heading', { level: 1, name: 'Alpha activity' })).toBeVisible();
	await expect(page.locator('html')).toHaveAttribute('data-environment', 'capacitor');
	const categories = page.getByRole('navigation', { name: 'Catalog categories' });
	await expect(categories.getByRole('link')).toHaveText(catalogCategories);
	const footer = page.getByRole('contentinfo');
	await expect(footer.getByRole('region', { name: 'Computer connection' })).toContainText(
		`Connected to ${hostName}`
	);
	expect(await inside(page, 'Computer connection')).toBe(true);
	expect(await fits(page)).toBe(true);
	await page.getByRole('button', { name: 'Conversation', exact: true }).click();
	await expect(page.getByRole('complementary', { name: 'Design conversation' })).toBeVisible();
	expect(await fits(page)).toBe(true);
	await remoteEvidence(page, testInfo, 'tablet-phone-workspace');
});

test('at a tablet width the approval shows the whole identity without overflowing', async ({
	page
}, testInfo) => {
	await remoteHostFixture(page, true);
	await page.goto('/');
	const panel = page.getByRole('region', { name: 'Phone access' });
	await panel.getByRole('button', { name: 'Pair a phone', exact: true }).click();
	await page.evaluate(() =>
		(window as unknown as { __remoteHost: { request: () => void } }).__remoteHost.request()
	);
	const request = panel.getByRole('group', { name: `${phone.name} asks to connect` });
	const whole = phone.deviceId.match(/.{4}/g)!.join(' ');
	await expect(request.getByText(whole)).toBeVisible();
	expect(await inside(page, 'Phone access')).toBe(true);
	expect(await fits(page)).toBe(true);
	await remoteEvidence(page, testInfo, 'tablet-desktop-approval');
});

test('a narrow status bar stacks its facts, and a wide one keeps them in one row', async ({
	page
}) => {
	await remotePhoneFixture(page, 'online');
	await page.setViewportSize({ width: 390, height: 844 });
	await page.goto(`/projects/${alpha}/harness/branch/feat%2Falpha/pages/page%3Aactivity`);
	await expect(page.getByRole('heading', { level: 1, name: 'Alpha activity' })).toBeVisible();
	await page.evaluate(() =>
		(window as unknown as { __remotePhone: { set: (state: string) => void } }).__remotePhone.set(
			'offline'
		)
	);
	const footer = page.getByRole('contentinfo');
	await expect(footer.getByText('Offline cached view', { exact: true })).toBeVisible();
	await expect(
		footer.getByText(/Read-only · saved .* · not checked with the server/)
	).toBeVisible();
	await expect(footer.getByText('Computer offline', { exact: true })).toBeVisible();
	const facts = () =>
		footer.locator(':scope > *').evaluateAll((items) =>
			items
				.map((item) => item.getBoundingClientRect())
				.filter((box) => box.height > 0)
				.map((box) => ({ left: Math.round(box.left), top: Math.round(box.top), width: box.width }))
		);
	const narrow = await facts();
	expect(narrow.length).toBeGreaterThanOrEqual(4);
	expect(new Set(narrow.map((box) => box.left)).size).toBe(1);
	for (let index = 1; index < narrow.length; index++)
		expect(narrow[index].top).toBeGreaterThan(narrow[index - 1].top);
	const state = await footer.getByText('Offline cached view', { exact: true }).boundingBox();
	expect(state!.height).toBeLessThan(24);
	expect(await fits(page)).toBe(true);
	await page.setViewportSize({ width: 1440, height: 900 });
	const wide = await facts();
	const tops = wide.map((box) => box.top);
	expect(Math.max(...tops) - Math.min(...tops)).toBeLessThan(16);
});
