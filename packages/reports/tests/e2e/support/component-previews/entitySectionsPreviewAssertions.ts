import { expect, type Locator } from '@playwright/test';

/** Named sections show their documented content, rather than only an empty-state notice. */
export async function assertPopulatedEntitySection(component: Locator, variant: string) {
	if (['states', 'tests'].includes(variant)) await assertSectionCaptures(component, variant);
	if (variant === 'contract') await assertSectionContract(component);
	if (!['audio', 'examples', 'permissions'].includes(variant)) return;
	await expect(
		component,
		'A named section has its representative recorded content'
	).not.toContainText(
		/No audio evidence is recorded|No usage examples are documented|No permission catalog is indexed|No access declaration names this endpoint/
	);
	await expect(component).not.toContainText(/\bPreview (?:project|agent|model|component)\b/i);
	if (variant === 'audio') {
		await expect(component.getByRole('heading', { name: 'Audio comparison' })).toBeVisible();
		await expect(component.locator('audio')).toHaveCount(2);
		await expect(component.getByText('Order filed.', { exact: true })).toHaveCount(2);
	}
	if (variant === 'examples') {
		await expect(component.getByText('Match a customer by name', { exact: true })).toBeVisible();
		await expect(component).toContainText('filterOrders(orders, "Ada")');
		await expect(component).toContainText('A-1048');
		await expect(component).toContainText('Ada Lovelace');
	}
	if (variant === 'permissions') {
		for (const name of ['Member', 'Administrator'])
			await expect(component.getByRole('link', { name, exact: true })).toBeVisible();
		await expect(component.getByRole('table')).toHaveCount(2);
		await expect(component).toContainText('Own account only');
		await expect(component).toContainText('All accounts');
		await expect(component).toContainText('DELETE');
	}
}

/** Select the recorded device through the gallery, while retaining absent-slot diagnostics. */
export async function prepareSectionCaptures(component: Locator, variant: string) {
	if (!['states', 'tests'].includes(variant)) return;
	const width = component.page().viewportSize()!.width;
	const viewport = width === 390 ? 'mobile' : width === 768 ? 'tablet' : 'desktop';
	const select = component.getByRole('combobox', { name: 'Viewport', exact: true });
	if (await select.locator(`option[value="${viewport}"]`).count())
		await select.selectOption(viewport);
}

async function assertSectionCaptures(component: Locator, variant: string) {
	const gallery = component.locator('.states-gallery');
	await expect(gallery, 'Required states have both recorded sides').not.toContainText(
		/No verification record is attached|No capture of|No screenshot was recorded/
	);
	const options = gallery
		.getByRole('combobox', { name: 'Viewport', exact: true })
		.locator('option');
	expect(
		await options.evaluateAll((nodes) => nodes.map((node) => node.getAttribute('value')))
	).toEqual(['desktop', 'tablet', 'mobile']);
	for (const title of ['Default', 'Empty']) {
		const images = gallery.getByRole('article', { name: title, exact: true }).locator('img');
		await expect(images, `${title} has Before and After images`).toHaveCount(2);
		const dimensions = await images.evaluateAll((nodes) =>
			nodes.map((node) => {
				const image = node as HTMLImageElement;
				return [image.naturalWidth, image.naturalHeight];
			})
		);
		const size = component.page().viewportSize()!;
		expect(dimensions, 'Nested captures use the selected CSS-pixel viewport').toEqual([
			[size.width, size.height],
			[size.width, size.height]
		]);
	}
	if (variant === 'tests') {
		const proof = component.getByRole('region', { name: 'Regression proof', exact: true });
		await expect(proof).not.toContainText('No regression proof is available');
		await expect(proof).toContainText('Regression fixed');
		await expect(proof.getByRole('link', { name: 'View failing test commit' })).toBeVisible();
		await expect(proof.getByRole('link', { name: 'View fix commit' })).toBeVisible();
	}
}

async function assertSectionContract(component: Locator) {
	const inputs = component.locator('[data-contract-input]');
	await expect(inputs.locator('.requirement')).toHaveText(['Required', 'Optional']);
	await expect(inputs.locator('.default')).toContainText(['No default', 'Default: ""']);
	await expect(component).not.toContainText('Requiredness not recorded');
	await expect(inputs.getByText('Declared', { exact: true }).first()).toBeVisible();
}
