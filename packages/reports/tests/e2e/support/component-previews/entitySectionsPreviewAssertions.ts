import { expect, type Locator } from '@playwright/test';

/** Named sections show their documented content, rather than only an empty-state notice. */
export async function assertPopulatedEntitySection(component: Locator, variant: string) {
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
