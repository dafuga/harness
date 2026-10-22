import { expect, test, type Page } from '../../../../test/support/browserTest';
import { at, explorer } from './support/explorer';
import { capturePhase, settled } from './support/harnessCapture';
import { seeded } from './support/harnessHistory';

const { commits } = seeded();
const { explorerUnits: units } = explorer();
const main = (rest: string) => at('main', commits.approved, rest);
const content = (page: Page) => page.locator('.ex-content');
const heading = (page: Page, name: string) => page.getByRole('heading', { level: 1, name });

test('a component screenshot keeps one 4:3 frame across desktop, tablet and mobile captures', async ({
	page
}) => {
	await page.setViewportSize({ width: 1280, height: 900 });
	await page.goto(main(`components/${units.list}`));
	await expect(heading(page, 'TitleList')).toBeVisible();
	const viewportGroup = content(page).getByRole('group', { name: 'Viewport' });
	const frame = content(page).locator('.ex-shot').first();
	const image = frame.locator('img');
	let baseline: { width: number; height: number } | undefined;

	for (const viewport of ['Desktop', 'Tablet', 'Mobile']) {
		await viewportGroup.getByRole('button', { name: viewport, exact: true }).click();
		await expect(image).toBeVisible();
		await settled(page);
		if (viewport === 'Desktop') await capturePhase(page, 'evidence-card-desktop-before-after');

		const dimensions = await frame.evaluate((element) => {
			const rect = element.getBoundingClientRect();
			const image = element.querySelector('img')!;
			return {
				width: rect.width,
				height: rect.height,
				fit: getComputedStyle(image).objectFit,
				naturalWidth: image.naturalWidth,
				naturalHeight: image.naturalHeight
			};
		});
		expect(dimensions.width / dimensions.height).toBeCloseTo(4 / 3, 2);
		expect(dimensions.fit).toBe('contain');
		expect(dimensions.naturalWidth).toBeGreaterThan(0);
		expect(dimensions.naturalHeight).toBeGreaterThan(0);
		if (baseline) {
			expect(dimensions.width).toBeCloseTo(baseline.width, 1);
			expect(dimensions.height).toBeCloseTo(baseline.height, 1);
		} else baseline = dimensions;

		if (viewport === 'Mobile') {
			const visibleWidth = Math.min(
				dimensions.width,
				(dimensions.height * dimensions.naturalWidth) / dimensions.naturalHeight
			);
			expect((dimensions.width - visibleWidth) / 2 / dimensions.width).toBeGreaterThan(0.25);
			await capturePhase(page, 'evidence-card-mobile-before-after');
		}
	}
});
