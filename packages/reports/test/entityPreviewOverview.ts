import { expect, type Page } from '@playwright/test';

/** Overview keeps one measurement profile, concise identity and state selection in States. */
export async function reviewOverviewControls(page: Page, category: string): Promise<void> {
	const profile = page.getByRole('region', { name: 'Performance profile', exact: true });
	await expect(
		page.getByRole('region', { name: 'Size', exact: true }),
		'size shares performance profile'
	).toHaveCount(0);
	await expect(profile).toHaveCount(1);
	for (const label of ['Source size', 'Emitted size', 'Complexity'])
		await expect(profile).toContainText(label);
	expect((await profile.boundingBox())!.width).toBeGreaterThan(
		(await page.locator('.ex-summary').boundingBox())!.width * 0.95
	);
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
