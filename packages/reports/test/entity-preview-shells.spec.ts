import { expect, test, type Page } from '../../../test/support/browserTest';
import { capture, fits, open, viewports } from './entityPreviewPage';
import { frameId } from './entityPreviewData';
import { commits, ids } from './entityUnits';

/**
 * Shells in the explorer over the synthetic history: the tip's manifest declares the orders frame
 * a shell, the commits before it recorded it as a component. A screenshot is kept before the
 * checks of each place when TAKE_SCREENSHOT=1, named by SCREENSHOT_LABEL.
 */
const label = process.env.SCREENSHOT_LABEL ?? 'run';
const content = (page: Page) => page.locator('.ex-content');
const frame = (page: Page) => content(page).getByText('OrderFrame', { exact: true });

/** Fonts drawn and every image decoded before a picture is kept. */
async function settled(page: Page, name: string): Promise<void> {
	await page.evaluate(async () => {
		await document.fonts.ready;
		await Promise.all([...document.images].map((image) => image.decode()));
	});
	await capture(page, `${label}-${name}`);
}

for (const [viewport, size] of [
	['desktop', viewports.desktop],
	['mobile', viewports.mobile]
] as const) {
	test(`Shells lists the frame at the branch tip, Components does not, at ${viewport} width`, async ({
		page
	}) => {
		await page.setViewportSize(size);
		await open(page, { category: 'layouts' }, 'layouts');
		await settled(page, `shells-catalog-${viewport}`);
		await expect(frame(page)).toBeVisible();
		expect(await fits(page)).toBe(true);
		await open(page, { category: 'components' }, 'layouts');
		await expect(content(page).getByText('OrderList', { exact: true }).first()).toBeVisible();
		// Components keeps no card of the frame; it is named only where a card lists its users.
		await expect(
			content(page).getByRole('article', { name: 'OrderFrame', exact: true })
		).toHaveCount(0);
		const asUser = content(page)
			.getByRole('group', { name: 'Used In', exact: true })
			.getByRole('link', { name: 'OrderFrame', exact: true });
		expect(await asUser.count()).toBeGreaterThan(0);
		for (const link of await asUser.all()) {
			await expect(link).toBeVisible();
			await expect(link).toHaveAttribute('href', new RegExp(`/layouts/${frameId}$`));
		}
		await expect(frame(page)).toHaveCount(await asUser.count());
	});
}

test('a commit that recorded the frame as a component lists it under Components, not Shells', async ({
	page
}) => {
	await open(page, { commit: commits.first, category: 'components' }, 'layouts');
	await settled(page, 'components-catalog-first-desktop');
	await expect(frame(page).first()).toBeVisible();
	await open(page, { commit: commits.first, category: 'layouts' }, 'layouts');
	await expect(frame(page)).toHaveCount(0);
});

test('the shell says it is a Shell, uses the order list and is used in the orders page', async ({
	page
}) => {
	await open(page, { category: 'layouts', entity: frameId, tab: 'used-in' }, 'layouts');
	await settled(page, 'shell-used-in-desktop');
	await expect(content(page).getByText('Layout', { exact: true }).first()).toBeVisible();
	const user = content(page).getByRole('article', { name: 'Orders page', exact: true });
	await expect(user.getByRole('link', { name: 'Open Orders page', exact: true })).toBeVisible();
	await open(page, { category: 'layouts', entity: frameId, tab: 'uses' }, 'layouts');
	await expect(content(page).getByRole('link', { name: 'OrderList', exact: true })).toBeVisible();
	await open(page, { commit: commits.first, category: 'components', entity: frameId }, 'layouts');
	await expect(content(page).getByText('Component', { exact: true }).first()).toBeVisible();
	await expect(content(page).getByText('Layout', { exact: true })).toHaveCount(0);
	expect(ids.page).toBe('app.page.orders');
});
