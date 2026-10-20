import { expect, type Page } from '@playwright/test';
import type { ExplorerLocation } from '../src/models/Explorer.types';
import { ids } from './entityUnits';

/** Every entity screen reads current source figures, even beside an older partial record. */
export async function reviewMeasuredSources(
	page: Page,
	visit: (route: Pick<ExplorerLocation, 'category' | 'entity'>) => Promise<void>
): Promise<void> {
	const routes = [
		{ category: 'pages' as const, entity: ids.page },
		{ category: 'shells' as const, entity: 'app.shell.orders' },
		{ category: 'components' as const, entity: ids.list },
		{ category: 'functions' as const, entity: ids.filter },
		{ category: 'configs' as const, entity: ids.settings },
		{ category: 'services' as const, entity: ids.store },
		{ category: 'models' as const, entity: 'app.model.order' }
	];
	for (const route of routes) {
		await visit(route);
		const profile = page.getByRole('region', { name: 'Performance profile', exact: true });
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
	const rows = await page
		.getByRole('region', { name: 'Performance profile', exact: true })
		.locator('dl > div')
		.evaluateAll((rows) =>
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
	await expect(
		page.locator('.ex-evidence-head p'),
		'screenshot heading has no explanatory paragraph'
	).toHaveCount(0);
}
