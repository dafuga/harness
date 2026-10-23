import { expect, type Locator, type Page } from '@playwright/test';
import type { ExplorerLocation } from '../src/models/Explorer.types';
import { ids } from './entityUnits';

/** Every entity screen reads current source figures, even beside an older partial record. */
export async function reviewMeasuredSources(
	page: Page,
	visit: (route: Pick<ExplorerLocation, 'category' | 'entity'>) => Promise<void>
): Promise<void> {
	const routes = [
		{ category: 'pages' as const, entity: ids.page },
		{ category: 'layouts' as const, entity: 'app.shell.orders' },
		{ category: 'components' as const, entity: ids.list },
		{ category: 'functions' as const, entity: ids.filter },
		{ category: 'configs' as const, entity: ids.settings },
		{ category: 'services' as const, entity: ids.store },
		{ category: 'models' as const, entity: 'app.model.order' }
	];
	for (const route of routes) {
		await visit(route);
		const profile = page.getByRole('region', { name: 'Performance profile', exact: true });
		if (route.category === 'pages') {
			const table = profile.getByRole('table', { name: 'Performance metric changes' });
			const source = table.locator('tbody tr').filter({ hasText: 'Source size' });
			const complexity = table.locator('tbody tr').filter({ hasText: 'Complexity' });
			await expect(source, 'page diff retains the measured source size').toContainText('12.3 KB');
			await expect(complexity, 'page diff retains the measured complexity').toContainText('21');
			continue;
		}
		const rows = await profile
			.locator('dl > div')
			.evaluateAll((rows) =>
				Object.fromEntries(
					rows.map((row) => [
						row.querySelector('dt')!.textContent!.trim(),
						row.querySelector('dd')!.textContent!.trim()
					])
				)
			);
		expect
			.soft(rows['Source size'], `${route.category}: selected-commit source size`)
			.toBe('12.3 KB');
		expect.soft(rows.Complexity, `${route.category}: selected-commit complexity`).toBe('21');
	}
}

/** Equal rows also keep equal spacing across size and timing facts, even when notes wrap. */
export async function reviewProfileRows(page: Page): Promise<void> {
	const profile = page.getByRole('region', { name: 'Performance profile', exact: true });
	const details = profile.locator('dl > div');
	const rows = await ((await details.count()) ? details : profile.locator('tbody tr')).evaluateAll(
		(rows) =>
			rows.map((row) => {
				const box = row.getBoundingClientRect();
				return { top: box.top, height: box.height };
			})
	);
	const heights = rows.map((row) => row.height);
	const spacing = rows.slice(1).map((row, index) => row.top - rows[index].top);
	expect
		.soft(Math.max(...heights) - Math.min(...heights), 'measurement rows have equal heights')
		.toBeLessThanOrEqual(1);
	expect
		.soft(Math.max(...spacing) - Math.min(...spacing), 'measurement rows follow uniform spacing')
		.toBeLessThanOrEqual(1);
}

/** Visual fixtures have no standalone compiled output, and all displayed rows share one height. */
async function reviewProfile(page: Page, category: string): Promise<void> {
	const profile = page.getByRole('region', { name: 'Performance profile', exact: true });
	await expect(
		page.getByRole('region', { name: 'Size', exact: true }),
		'size shares performance profile'
	).toHaveCount(0);
	await expect(profile).toHaveCount(1);
	for (const label of ['Source size', 'Complexity']) await expect(profile).toContainText(label);
	if (category === 'pages') {
		const card = (await profile.boundingBox())!;
		const evidence = (await page
			.locator('section[aria-labelledby="ex-screens-title"]')
			.boundingBox())!;
		expect
			.soft(card.y - evidence.y - evidence.height, 'performance profile has space above it')
			.toBeGreaterThanOrEqual(16);
	}
	await reviewProfileRows(page);
	expect
		.soft(
			await profile.getByText('Emitted size', { exact: true }).count(),
			'no output-size row without a compiled target'
		)
		.toBe(0);
	expect((await profile.boundingBox())!.width).toBeGreaterThan(
		(await page.locator('.ex-summary').boundingBox())!.width * 0.95
	);
}

/** Overview keeps one measurement profile, concise identity and state selection in States. */
export async function reviewOverviewControls(page: Page, category: string): Promise<void> {
	await reviewProfile(page, category);
	if (category === 'pages') {
		const description = page
			.getByRole('tabpanel', { name: 'Orders page overview', exact: true })
			.getByText('Lists the orders of an account.', { exact: true });
		await expect(description, 'page Overview describes what the page does').toHaveCount(1);
		expect((await description.boundingBox())!.y).toBeLessThan(
			(await page.locator('.ex-evidence-head').boundingBox())!.y
		);
		await expect(
			page.getByRole('tab', { name: 'Used In', exact: true }),
			'pages omit Used In'
		).toHaveCount(0);
		await expect(
			page.locator('.ex-head .ex-lead, .ex-head .ex-route'),
			'page header stays concise'
		).toHaveCount(0);
	}
	await expect(
		page.getByRole('combobox', { name: /^(Scenario|State)$/ }),
		'overview has no state controls'
	).toHaveCount(0);
	await expect(page.getByRole('link', { name: 'View commit changes', exact: true })).toHaveCount(0);
	await expect
		.soft(
			page.locator('.ex-pane figcaption .ex-standing'),
			'captions contain only revision identity'
		)
		.toHaveCount(0);
	await expect
		.soft(page.getByRole('button', { name: 'Open full size', exact: true }), 'images open directly')
		.toHaveCount(0);
	await expect(
		page.locator('.ex-evidence-head p'),
		'screenshot heading has no explanatory paragraph'
	).toHaveCount(0);
}

/** A focused capture remains usable without pretending there is a full verification record. */
export async function reviewFocusedScreens(
	page: Page,
	name: string,
	visit: () => Promise<void>,
	capture: (name: string) => Promise<void>
): Promise<void> {
	await visit();
	await capture('focused-screens-' + name);
	const panel = page.locator('section[aria-labelledby="ex-screens-title"]');
	await expect
		.soft(panel.getByRole('img'), 'focused screenshots appear on both committed sides')
		.toHaveCount(2);
	await expect.soft(panel).not.toContainText('Focused capture');
	for (const label of ['Desktop', 'Tablet', 'Mobile']) {
		const button = panel.getByRole('button', { name: label, exact: true });
		await expect.soft(button, 'every viewport has a capture').toHaveCount(1);
		if (await button.count()) {
			await button.click();
			await expect
				.soft(panel.locator('img').last())
				.toHaveAttribute('src', new RegExp('-default-' + label.toLowerCase() + '.png$'));
			for (const image of await panel.getByRole('img').all())
				await image.evaluate((node: HTMLImageElement) => node.decode());
		}
	}
}

/** The overview presents one observed value per metric instead of workload tables. */
export async function reviewScalarMeasurements(page: Page): Promise<void> {
	const profile = page.getByRole('region', { name: 'Performance profile' });
	await expect.soft(profile.getByRole('table'), 'overview performance has no table').toHaveCount(0);
	const rows = await profile
		.locator('dl > div')
		.evaluateAll((items) =>
			Object.fromEntries(
				items.map((row) => [
					row.querySelector('dt')!.textContent!.trim(),
					row.querySelector('dd')!.textContent!.trim()
				])
			)
		);
	expect.soft(rows.Latency, 'one latency value').toBe('0.12 ms');
	expect.soft(rows.Memory, 'one memory value').toBe('93 MB');
	await reviewProfileRows(page);
}

/** A component keeps the same screenshot above its tabs in the selected revision. */
export async function reviewComponentCapture(
	page: Page,
	evidence: Locator,
	commit: string | null
): Promise<void> {
	await expect(evidence, 'component screenshot persists across tabs').toHaveCount(1);
	const tabs = await page.getByRole('tablist').boundingBox();
	const shot = await page.locator('section[aria-labelledby="ex-screens-title"]').boundingBox();
	expect(shot!.y + shot!.height, 'component screenshot stays above its tabs').toBeLessThanOrEqual(
		tabs!.y
	);
	const files = await page
		.locator('section[aria-labelledby="ex-screens-title"] img')
		.evaluateAll((images) => images.map((image) => image.getAttribute('src')));
	expect(files).toEqual(
		commit
			? ['/media/aaaaaaa-default-desktop.png', '/media/bbbbbbb-default-desktop.png']
			: ['/media/ccccccc-default-desktop.png']
	);
}
