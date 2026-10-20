import { expect, type Page } from '@playwright/test';

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
	const heights = await profile
		.locator('dl > div')
		.evaluateAll((rows) => rows.map((row) => row.getBoundingClientRect().height));
	expect
		.soft(Math.max(...heights) - Math.min(...heights), 'measurement rows have equal heights')
		.toBeLessThanOrEqual(1);
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
