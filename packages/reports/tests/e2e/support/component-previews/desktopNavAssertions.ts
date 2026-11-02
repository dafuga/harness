import { expect, type Locator } from '@playwright/test';
import {
	assertNavContext,
	assertNavContextClear,
	assertMobileNavLayout,
	assertGameNavGlyph
} from './desktopNavLayoutAssertions';
import { assertRevisionTriggerContent } from './desktopRevisionTriggerAssertions';

/** Catalog navigation keeps its context rail and icon labels aligned across viewport sizes. */
export async function assertDesktopNavCapture(component: Locator, id: string) {
	if (id !== 'desktop.component.nav-bar') return;
	const tabs = component.getByRole('navigation', { name: 'Catalog categories' });
	const width = component.page().viewportSize()!.width;
	await assertNavContext(component, width);
	await assertNavContextClear(component, width);
	await assertRevisionTriggerContent(component, width);
	await assertMobileNavLayout(component, tabs, width);
	await expect(
		tabs.locator('a').first(),
		'First category remains fully visible at rest'
	).toBeInViewport({ ratio: 1 });
	if (width > 560) {
		const rows = await tabs
			.locator('a')
			.evaluateAll((links) => links.map((link) => Math.round(link.getBoundingClientRect().top)));
		expect(new Set(rows).size, 'Tablet and desktop categories use one continuous tab row').toBe(1);
		const complete = await tabs.evaluate((node) => {
			const row = node.getBoundingClientRect();
			return [...node.querySelectorAll('a span')].every((label) => {
				const caption = label.getBoundingClientRect();
				return caption.left >= row.left - 1 && caption.right <= row.right + 1;
			});
		});
		expect(complete, 'Catalog category captions fit completely at the recorded width').toBe(true);
	}
	if (width > 560 && width <= 900) {
		const rail = await component.locator('.environment-picker').boundingBox();
		const row = await tabs.boundingBox();
		expect(
			Math.abs(rail!.x - row!.x),
			'Tablet context rail starts near the header edge'
		).toBeLessThanOrEqual(12);
		expect(rail!.y + rail!.height, 'Context rail sits above the tabs').toBeLessThanOrEqual(
			row!.y + 1
		);
	}
	const game = tabs.getByRole('link', { name: 'Game Views', exact: true });
	if (await game.count()) {
		await expect(game.locator('svg'), 'Game Views has a category icon').toHaveCount(1);
		await assertGameNavGlyph(game, tabs);
		await expect(game.locator('span')).toHaveText('Game Views');
		const direction = await tabs
			.locator('a')
			.first()
			.evaluate((link) => getComputedStyle(link).flexDirection);
		await expect(
			game,
			'Game Views uses the same icon and label layout as other categories'
		).toHaveCSS('flex-direction', direction);
		await expect(game).toBeInViewport({ ratio: 1 });
	}
}
