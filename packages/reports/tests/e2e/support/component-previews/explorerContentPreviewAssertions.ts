import { expect, type Locator } from '@playwright/test';

/** A named catalog section proves its recorded content, not only its heading. */
export async function assertExplorerContentCatalog(
	component: Locator,
	id: string,
	variant: string
) {
	if (
		id !== 'reports.component.harness-explorer-content' ||
		!['dependencies', 'modules', 'permissions', 'translations', 'platforms'].includes(variant)
	)
		return;
	await expect(component, 'Named sections show populated revision catalogs').not.toContainText(
		/No (?:dependency record|plugin catalog|permission catalog|translation catalog|platform configuration)/
	);
	await expect(component, 'Catalog examples use realistic names').not.toContainText(
		/\bPreview (?:project|agent|model)\b/i
	);
	if (variant === 'dependencies') {
		await expect(component.getByRole('table', { name: 'npm dependencies' })).toBeVisible();
		await expect(component.getByRole('rowheader', { name: 'zod', exact: true })).toHaveCount(2);
		await expect(component.getByRole('table', { name: 'Cargo dependencies' })).toContainText(
			'serde'
		);
	}
	if (variant === 'modules') {
		await expect(component.getByRole('link', { name: 'Email', exact: true })).toBeVisible();
		await expect(component.getByRole('link', { name: 'Offline', exact: true })).toBeVisible();
	}
	if (variant === 'permissions') {
		for (const name of ['Guest', 'Member', 'Administrator'])
			await expect(component.getByRole('link', { name, exact: true })).toBeVisible();
	}
	if (variant === 'translations') {
		await expect(
			component.getByRole('columnheader', { name: 'English', exact: true })
		).toBeVisible();
		await expect(
			component.getByRole('columnheader', { name: 'French', exact: true })
		).toBeVisible();
		await expect(
			component.getByRole('region', { name: 'Translation strings' }).locator('tbody tr')
		).toHaveCount(3);
	}
	if (variant === 'platforms') {
		await expect(component.locator('.pf-card')).toHaveCount(4);
		await expect(component.locator('.pf-card [data-status="not-recorded"]')).toHaveCount(0);
		await expect(component.getByText('SvelteKit on Cloudflare', { exact: true })).toBeVisible();
		await expect(component.getByText('Electron', { exact: true })).toBeVisible();
	}
}
