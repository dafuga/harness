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

/** Context controls wrap or shrink instead of painting over one another at tablet and desktop widths. */
export async function assertNavContextClear(component: Locator, width: number) {
	if (width <= 560) return;
	const boxes = await component
		.locator('.environment-picker, .revision-picker, .topbar-search')
		.evaluateAll((nodes) =>
			nodes.map((node) => {
				const { left, right, top, bottom } = node.getBoundingClientRect();
				return { left, right, top, bottom, fits: node.scrollWidth <= node.clientWidth + 1 };
			})
		);
	for (let index = 0; index < boxes.length; index++) {
		for (let other = index + 1; other < boxes.length; other++) {
			const a = boxes[index],
				b = boxes[other];
			const overlaps =
				a.left < b.right - 1 &&
				b.left < a.right - 1 &&
				a.top < b.bottom - 1 &&
				b.top < a.bottom - 1;
			expect(overlaps, 'Context controls never paint over one another').toBe(false);
		}
	}
	expect(
		boxes.every((box) => box.fits),
		'Revision summary text stays inside its own control'
	).toBe(true);
}

/** A mobile header keeps balanced category rows and its account alongside the project. */
export async function assertMobileNavLayout(component: Locator, tabs: Locator, width: number) {
	if (width > 560) return;
	await assertMobileNavControls(component, tabs);
	const name = component.locator('.project-name');
	const fits = await name.evaluate((node) => node.scrollWidth <= node.clientWidth + 1);
	expect(fits, 'Project name stays readable beside the mobile account').toBe(true);
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

/** The compact rail preserves readable hit targets without taking over the page. */
async function assertMobileNavControls(component: Locator, tabs: Locator) {
	const height = (await component.locator('header.topbar').boundingBox())!.height;
	const game = await tabs.getByRole('link', { name: 'Game Views', exact: true }).count();
	expect(height, 'Mobile navigation leaves room for project content').toBeLessThanOrEqual(
		game ? 220 : 184
	);
	const search = (await component
		.getByRole('button', { name: 'Search entities', exact: true })
		.boundingBox())!;
	for (const label of ['Choose branch', 'Choose commit']) {
		const control = component.getByRole('button', { name: label, exact: true });
		const bounds = (await control.boundingBox())!;
		expect(
			bounds.x + bounds.width,
			'Search does not cover labelled revision controls'
		).toBeLessThanOrEqual(search.x);
		const fits = await control.evaluate((node) => node.scrollWidth <= node.clientWidth + 1);
		expect(fits, 'Revision icons and labels fit inside their own hit target').toBe(true);
	}
}
