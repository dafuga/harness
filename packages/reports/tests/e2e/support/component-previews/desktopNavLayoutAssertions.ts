import { expect, type Locator } from '@playwright/test';

export async function assertGameNavGlyph(game: Locator, tabs: Locator) {
	const fallback = await tabs.locator('a').first().locator('svg path').getAttribute('d');
	await expect(
		game.locator('svg path'),
		'Game Views has a distinct controller glyph'
	).not.toHaveAttribute('d', fallback!);
}

/** The context controls form a joined group, rather than float across the header. */
export async function assertNavContext(component: Locator, width: number) {
	if (width <= 560) return;
	const environment = await component.locator('.environment-picker').boundingBox();
	const revision = await component.locator('.revision-picker').boundingBox();
	const gap = await component
		.locator('header.topbar')
		.evaluate((node) => parseFloat(getComputedStyle(node).getPropertyValue('--hx-space-16')));
	expect(
		revision!.x - environment!.x - environment!.width,
		'Environment and revision controls share one context group'
	).toBeLessThanOrEqual(gap + 1);
	expect(
		Math.abs(environment!.y + environment!.height / 2 - revision!.y - revision!.height / 2),
		'Environment and revision controls align on the same row'
	).toBeLessThanOrEqual(8);
}

/** A mobile header keeps balanced category rows and its account alongside the project. */
export async function assertMobileNavLayout(component: Locator, tabs: Locator, width: number) {
	if (width > 560) return;
	const counts = await tabs.locator('a').evaluateAll((links) => {
		const rows = new Map<number, number>();
		for (const link of links) {
			const y = Math.round(link.getBoundingClientRect().top);
			rows.set(y, (rows.get(y) ?? 0) + 1);
		}
		return [...rows.values()];
	});
	expect(new Set(counts).size, 'Mobile category rows are evenly filled without orphans').toBe(1);
	const account = component.locator('.account').getByRole('button').first();
	if (await account.count()) {
		const chip = (await account.boundingBox())!;
		const project = (await component.locator('.project-switcher').boundingBox())!;
		expect(
			Math.abs(chip.y + chip.height / 2 - project.y - project.height / 2),
			'Mobile account aligns with the project header'
		).toBeLessThanOrEqual(8);
	}
}
