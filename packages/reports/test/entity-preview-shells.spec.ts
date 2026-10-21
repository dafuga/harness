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
const frame = (page: Page) =>
	content(page).locator('.ex-row-name, h2').getByRole('link', { name: 'Order frame', exact: true });

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
		await open(page, { category: 'shells' }, 'shells');
		await settled(page, `shells-catalog-${viewport}`);
		await expect(frame(page)).toBeVisible();
		expect(await fits(page)).toBe(true);
		await open(page, { category: 'components' }, 'shells');
		await expect(content(page).getByText('Order list', { exact: true }).first()).toBeVisible();
		await expect(frame(page)).toHaveCount(0);
	});
}

test('a commit that recorded the frame as a component lists it under Components, not Shells', async ({
	page
}) => {
	await open(page, { commit: commits.first, category: 'components' }, 'shells');
	await settled(page, 'components-catalog-first-desktop');
	await expect(frame(page).first()).toBeVisible();
	await open(page, { commit: commits.first, category: 'shells' }, 'shells');
	await expect(frame(page)).toHaveCount(0);
});

test('the shell says it is a Shell, uses the order list and is used in the orders page', async ({
	page
}) => {
	await open(page, { category: 'shells', entity: frameId, tab: 'used-in' }, 'shells');
	await settled(page, 'shell-used-in-desktop');
	await expect(content(page).getByText('Shell', { exact: true }).first()).toBeVisible();
	await expect(
		content(page).getByRole('link', { name: 'Open Orders page', exact: true })
	).toBeVisible();
	await open(page, { category: 'shells', entity: frameId, tab: 'uses' }, 'shells');
	await expect(content(page).getByRole('link', { name: 'Order list', exact: true })).toBeVisible();
	await open(page, { commit: commits.first, category: 'components', entity: frameId }, 'shells');
	await expect(content(page).getByText('Component', { exact: true }).first()).toBeVisible();
	await expect(content(page).getByText('Shell', { exact: true })).toHaveCount(0);
	expect(ids.page).toBe('app.page.orders');
});
