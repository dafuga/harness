import { expect, test, type Page } from '../../../../test/support/browserTest';
import { hostedFixture } from './hosted-fixture';
import {
	backgroundLightness,
	box,
	capture,
	captureHomeScenario,
	contrast,
	homeViewports,
	macRelease
} from './hosted-home';

const archive = '/downloads/Harness-mac-arm64.zip';
const pendingMac = 'Mac app coming soon';
const hero = (page: Page) => page.getByRole('heading', { level: 1, name: /Build with agents/ });
const download = (page: Page) => page.getByRole('region', { name: 'Get Harness on your Mac' });
const missing = {
	type: 'console' as const,
	message: 'Failed to load resource: the server responded with a status of 404 (Not Found)',
	reason: 'The homepage asks whether the Mac archive is published; before release it is not.'
};
const views = [
	{ name: 'phone', width: 390, height: 844 },
	{ name: 'desktop', width: 1280, height: 800 }
] as const;

test('a visitor reads the public About page and Log in opens the Hub gate', async ({ page }) => {
	const state = await hostedFixture(page, { signedIn: false });
	await macRelease(page, 'page');
	await page.goto('/about');
	await expect(hero(page)).toBeVisible();
	await expect(page).toHaveTitle('Harness · Build with agents');
	await expect(page.getByRole('heading', { name: 'Shared projects' })).toHaveCount(0);
	await expect(page.getByRole('button', { name: 'Sign in with Google' })).toHaveCount(0);
	const entries = page.getByRole('link', { name: 'Log in', exact: true });
	await expect(entries).toHaveCount(3);
	for (const entry of await entries.all()) await expect(entry).toHaveAttribute('href', '/');
	await page.getByRole('banner').getByRole('link', { name: 'Log in' }).click();
	await expect(page).toHaveURL(/\/$/);
	await expect(page.getByRole('button', { name: 'Sign in with Google' })).toBeVisible();
	expect(state.calls.map((call) => call.path)).toEqual([
		'/api/auth/status',
		'/api/auth/status',
		'/api/auth/challenge'
	]);
});

test('a signed-in person gets the six-section Hub home', async ({ page }) => {
	await hostedFixture(page);
	await macRelease(page, 'page');
	await page.route('**/api/tracker-overview', (route) =>
		route.fulfill({ json: { status: 'ready', projects: [], machines: [], liveSessions: 0 } })
	);
	await page.route('**/api/hub-home', (route) =>
		route.fulfill({ json: { agents: [], plans: [], scheduled: [], quota: [] } })
	);
	await page.goto('/');
	await expect(page).toHaveTitle('Harness · Home');
	for (const name of ['Agents', 'Quota', 'Plans', 'Scheduled', 'Projects', 'Work in progress']) {
		const card = page.getByRole('region', { name, exact: true });
		await expect(card).toBeVisible();
		const more = card.getByRole('button', { name: /see all/i });
		await more.click();
		await expect(page.getByRole('dialog', { name, exact: true })).toBeVisible();
		await page.keyboard.press('Escape');
		await expect(more).toBeFocused();
	}
	await expect(hero(page)).toHaveCount(0);
});

test('a published Mac archive becomes the download link', async ({ page }) => {
	await hostedFixture(page, { signedIn: false });
	const asked = await macRelease(page, 'zip');
	for (const viewport of homeViewports) {
		await page.setViewportSize({ width: viewport.width, height: viewport.height });
		await published(page);
		await captureHomeScenario(page, 'available', viewport.id);
		if (viewport.id === 'desktop') await capture(page, 'home-desktop-mac-available');
	}
	expect(asked).toEqual(homeViewports.map(() => 'HEAD'));
});

async function published(page: Page) {
	await page.goto('/about');
	const link = download(page).getByRole('link', { name: 'Download for Mac' });
	await expect(link).toHaveAttribute('href', archive);
	await expect(link).toHaveAttribute('download', '');
	await expect(
		page.getByRole('main').getByRole('link', { name: 'Download for Mac' }).first()
	).toHaveAttribute('href', archive);
	await expect(download(page).getByRole('button', { name: pendingMac })).toHaveCount(0);
	await expect(download(page).getByText('iPhone app · Coming soon')).toBeVisible();
}

for (const answer of ['missing', 'page'] as const)
	test(`a ${answer} Mac archive keeps the download pending`, async ({ page, browserErrors }) => {
		if (answer === 'missing') browserErrors.expectError(missing);
		await page.setViewportSize({ width: 920, height: 960 });
		await hostedFixture(page, { signedIn: false });
		const asked = await macRelease(page, answer);
		await page.goto('/about');
		await expect.poll(() => asked.length).toBe(1);
		await expect(download(page).getByText(/Mac build is being prepared/)).toBeVisible();
		await capture(page, `home-tablet-mac-${answer}`);
		const pending = download(page).getByRole('button', { name: pendingMac, exact: true });
		await expect(pending).toBeDisabled();
		await expect(pending).toHaveAccessibleDescription(/Mac build is being prepared/);
		const heroRegion = page.getByRole('region', { name: /Build with agents/ });
		await expect(heroRegion.getByText(pendingMac, { exact: true })).toBeVisible();
		await expect(heroRegion.getByRole('link', { name: pendingMac })).toHaveCount(0);
		await expect(heroRegion.getByRole('button')).toHaveCount(0);
		await expect(heroRegion.getByRole('link', { name: 'Log in', exact: true })).toHaveClass(
			/home-button-primary/
		);
		await expect(page.locator(`a[href="${archive}"]`)).toHaveCount(0);
		await expect(download(page).getByText('iPhone app · Coming soon')).toBeVisible();
		if (answer === 'missing') await captureHomeScenario(page, 'default', 'tablet');
	});

for (const view of views)
	for (const scheme of ['light', 'dark'] as const)
		test(`the homepage fits a ${view.name} and reads clearly in ${scheme}`, async ({ page }) => {
			await page.emulateMedia({ colorScheme: scheme });
			await page.setViewportSize({ width: view.width, height: view.height });
			await hostedFixture(page, { signedIn: false });
			await macRelease(page, 'page');
			await page.goto('/about');
			await expect(download(page).getByText(/Mac build is being prepared/)).toBeVisible();
			await capture(page, `home-${view.name}-${scheme}`);
			await expect(download(page).getByRole('button', { name: pendingMac })).toBeVisible();
			expect(await page.evaluate(() => document.documentElement.scrollWidth)).toBeLessThanOrEqual(
				view.width
			);
			const lightness = await backgroundLightness(page);
			if (scheme === 'light') expect(lightness).toBeGreaterThan(0.85);
			else expect(lightness).toBeLessThan(0.2);
			expect(await contrast(page, hero(page))).toBeGreaterThanOrEqual(7);
			for (const quiet of [
				page.getByText(/Harness gives every project a clear shape/),
				page.getByText('For people who build software with coding agents'),
				page.getByText(/Mac app · Shared projects in any browser/),
				page.getByText('Ship what you can prove.')
			])
				expect(await contrast(page, quiet)).toBeGreaterThanOrEqual(4.5);
			await layout(page, view.name === 'desktop');
			if (scheme === 'dark')
				await captureHomeScenario(page, 'default', view.name === 'phone' ? 'mobile' : 'desktop');
		});

/** On a desktop the hero sits beside its loop and the steps share a row; on a phone they stack. */
async function layout(page: Page, wide: boolean) {
	const copy = await box(hero(page));
	const loop = await box(page.getByRole('figure', { name: /evidence/ }));
	const steps = await Promise.all(
		(
			await page
				.getByRole('region', { name: /three steps/ })
				.getByRole('listitem')
				.all()
		).map(box)
	);
	const bar = page.getByRole('banner');
	await expect(bar.getByRole('link', { name: 'Log in' })).toBeVisible();
	if (wide) {
		expect(loop.x).toBeGreaterThanOrEqual(copy.x + copy.width);
		expect(new Set(steps.map((step) => Math.round(step.y))).size).toBe(1);
		await expect(bar.getByRole('link', { name: 'How it works' })).toBeVisible();
		return;
	}
	expect(loop.y).toBeGreaterThanOrEqual(copy.y + copy.height);
	for (let index = 1; index < steps.length; index++)
		expect(steps[index].y).toBeGreaterThanOrEqual(steps[index - 1].y + steps[index - 1].height);
	await expect(bar.getByRole('link', { name: 'How it works' })).toBeHidden();
}
