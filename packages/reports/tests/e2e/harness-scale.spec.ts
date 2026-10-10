import { expect, test, type Page } from '@playwright/test';

const scale = `http://127.0.0.1:${Number(process.env.HARNESS_CONSOLE_E2E_SCALE_PORT || 5593)}`;
test.use({ baseURL: scale });

const map = (page: Page) => page.getByRole('group', { name: 'Component map' });
const list = (page: Page) => page.getByRole('list', { name: 'Components' });
const node = (page: Page, id: string) => map(page).locator(`[data-unit="${id}"]`);
const widthOf = async (page: Page, id: string) => (await node(page, id).boundingBox())?.width ?? 0;
const focused = (page: Page) =>
	page.evaluate(() => document.activeElement?.getAttribute('data-unit') ?? '');

test('a map of several hundred units stays searchable, readable and keyboard operable', async ({
	page
}) => {
	await page.goto('/harness');
	await expect(page.getByText('488 of 488 components')).toBeVisible();
	await expect(map(page).locator('.hc-node')).toHaveCount(488);
	// The whole map is an overview: no web of lines, and exactly one stop in the tab order.
	await expect(map(page).locator('.hc-edge')).toHaveCount(0);
	await expect(page.getByText('Dependencies are drawn for the selected component.')).toBeVisible();
	await expect(map(page).locator('[tabindex="0"]')).toHaveCount(1);
	expect(await widthOf(page, 'function.generated-300')).toBeLessThan(60);

	await page.getByRole('searchbox', { name: 'Search components' }).fill('generated-30');
	await expect(list(page).getByRole('button')).toHaveCount(10);
	await expect(node(page, 'function.generated-000')).toHaveAttribute('aria-hidden', 'true');
	await list(page)
		.getByRole('button', { name: /^function\.generated-300/ })
		.click();
	const details = page.getByRole('region', { name: 'Component details' });
	await expect(details.getByRole('heading', { name: 'function.generated-300' })).toBeVisible();
	await expect(details.getByRole('group', { name: 'Depends on' })).toContainText(
		'function.generated-180'
	);
	// Choosing it brought it into view large enough to read, with its own dependencies drawn.
	await expect.poll(() => widthOf(page, 'function.generated-300')).toBeGreaterThan(120);
	await map(page).scrollIntoViewIfNeeded();
	await expect(node(page, 'function.generated-300')).toBeInViewport();
	await expect(map(page).locator('.hc-edge')).toHaveCount(4);

	await page.getByRole('searchbox', { name: 'Search components' }).fill('');
	await node(page, 'function.generated-300').focus();
	await page.keyboard.press('ArrowRight');
	const beside = await focused(page);
	expect(beside).toMatch(/^function\.generated-\d{3}$/);
	expect(beside).not.toBe('function.generated-300');
	await page.keyboard.press('ArrowDown');
	const below = await focused(page);
	expect(below).not.toBe(beside);
	await page.keyboard.press('Enter');
	await expect(details.getByRole('heading', { name: below })).toBeVisible();
	await expect(node(page, below)).toHaveAttribute('aria-pressed', 'true');
	await expect(map(page).locator('[tabindex="0"]')).toHaveCount(1);

	await page.getByRole('button', { name: 'Fit' }).click();
	await expect.poll(() => widthOf(page, below)).toBeLessThan(60);
});

test('on a phone the list reaches any unit and touch moves the map', async ({ browser }) => {
	const context = await browser.newContext({
		baseURL: scale,
		viewport: { width: 390, height: 844 },
		hasTouch: true,
		isMobile: true
	});
	const page = await context.newPage();
	await page.goto('/harness');
	await page.getByRole('searchbox', { name: 'Search components' }).fill('generated-417');
	await list(page)
		.getByRole('button', { name: /^function\.generated-417/ })
		.tap();
	await expect(
		page
			.getByRole('region', { name: 'Component details' })
			.getByRole('heading', { name: 'function.generated-417' })
	).toBeVisible();
	await map(page).scrollIntoViewIfNeeded();
	await expect.poll(() => widthOf(page, 'function.generated-417')).toBeGreaterThan(60);
	await expect(node(page, 'function.generated-417')).toBeInViewport();
	expect(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth)).toBe(true);

	// Dragging the map pans it instead of scrolling the page away.
	const before = await node(page, 'function.generated-417').boundingBox();
	const box = await map(page).boundingBox();
	const start = { x: (box?.x ?? 0) + 30, y: (box?.y ?? 0) + (box?.height ?? 0) - 30 };
	await page.evaluate(({ x, y }) => {
		const target = document.querySelector('svg[aria-label="Component map"]') as SVGElement;
		const fire = (type: string, clientX: number, clientY: number) =>
			target.dispatchEvent(
				new PointerEvent(type, {
					pointerId: 7,
					pointerType: 'touch',
					clientX,
					clientY,
					bubbles: true
				})
			);
		fire('pointerdown', x, y);
		fire('pointermove', x + 40, y - 30);
		fire('pointerup', x + 40, y - 30);
	}, start);
	const after = await node(page, 'function.generated-417').boundingBox();
	expect(Math.round((after?.x ?? 0) - (before?.x ?? 0))).toBeGreaterThan(20);
	await context.close();
});
