import { expect, test, type Page } from '../../../../test/support/browserTest';
import { hostedFixture } from './hosted-fixture';
import { backgroundLightness, box, capture, contrast } from './hosted-home';

const hero = (page: Page) => page.getByRole('heading', { level: 1, name: /Build with agents/ });
const signIn = (page: Page) => page.getByRole('button', { name: 'Sign in with Google' });
const download = (page: Page) => page.getByRole('region', { name: 'Get Harness on your Mac' });
const views = [
	{ name: 'phone', width: 390, height: 844 },
	{ name: 'desktop', width: 1280, height: 800 }
] as const;

test('a visitor reads what Harness is, then finds the download and the way in', async ({
	page
}) => {
	const state = await hostedFixture(page, { signedIn: false });
	await page.goto('/');
	await expect(hero(page)).toBeVisible();
	await expect(page).toHaveTitle('Harness · Build with agents');
	await expect(page.getByRole('heading', { name: 'Shared projects' })).toHaveCount(0);
	await expect(page.getByRole('region', { name: 'Log in' }).getByRole('button')).toHaveText(
		'Sign in with Google'
	);
	const steps = page.getByRole('region', { name: /three steps/ }).getByRole('listitem');
	await expect(steps).toHaveCount(3);
	await page.getByRole('link', { name: 'Download for Mac' }).click();
	await expect(page).toHaveURL(/#download$/);
	await expect(download(page)).toBeInViewport();
	const pending = download(page).getByRole('button', { name: 'Download for Mac' });
	await expect(pending).toBeDisabled();
	await expect(pending).toHaveAccessibleDescription(/Mac build is being prepared/);
	await expect(download(page).getByText('iPhone app · Coming soon')).toBeVisible();
	expect(state.calls.map((call) => call.path)).toEqual(['/api/auth/status', '/api/auth/challenge']);
});

test('Log in signs the visitor in and opens their projects', async ({ page }) => {
	await hostedFixture(page, { signedIn: false });
	await page.goto('/');
	await page.getByRole('banner').getByRole('link', { name: 'Log in' }).click();
	await expect(page).toHaveURL(/#sign-in$/);
	await expect(signIn(page)).toBeInViewport();
	await signIn(page).click();
	await expect(page.getByRole('heading', { level: 1, name: 'Shared projects' })).toBeVisible();
	await expect(page.getByRole('link', { name: 'Open Atlas', exact: true })).toBeVisible();
	await expect(hero(page)).toHaveCount(0);
	await expect(page).toHaveTitle('Harness · Shared projects');
});

test('a person who is signed in goes straight to their projects', async ({ page }) => {
	await hostedFixture(page);
	await page.goto('/');
	await expect(page.getByRole('link', { name: 'Open Atlas', exact: true })).toBeVisible();
	await expect(hero(page)).toHaveCount(0);
	await expect(page.getByRole('button', { name: 'Download for Mac' })).toHaveCount(0);
});

for (const view of views)
	for (const scheme of ['light', 'dark'] as const)
		test(`the homepage fits a ${view.name} and reads clearly in ${scheme}`, async ({ page }) => {
			await page.emulateMedia({ colorScheme: scheme });
			await page.setViewportSize({ width: view.width, height: view.height });
			await hostedFixture(page, { signedIn: false });
			await page.goto('/');
			await expect(signIn(page)).toBeVisible();
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
			await capture(page, `home-${view.name}-${scheme}`);
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
