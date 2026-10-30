import { expect, type Locator } from '@playwright/test';

/** Check each checkout and list boundary, opening the matching list when requested. */
export async function prepareActivityFileState(component: Locator, variant: string) {
	if (variant === 'truncated' || variant.endsWith('uncommitted'))
		await expect(
			component.getByRole('list', { name: 'Uncommitted files' }).locator('li').first()
		).toContainText('reports.component.activity-list');
	if (variant.endsWith('committed') && !variant.endsWith('uncommitted'))
		await expect(
			component.getByRole('list', { name: 'Committed files' }).locator('li').first()
		).toContainText('reports.component.activity-list');
	if (variant === 'multiple-checkouts')
		await expect(component.getByText('Feature checkout · branch feature/activity')).toBeVisible();
	if (
		!['many-uncommitted', 'expanded-uncommitted', 'many-committed', 'expanded-committed'].includes(
			variant
		)
	)
		return;
	const name = variant.endsWith('uncommitted') ? 'uncommitted files' : 'committed files';
	const button = component.getByRole('button', { name: `Show all 7 ${name}` });
	await expect(button).toBeVisible();
	if (variant.startsWith('expanded')) {
		await button.click();
		await expect(component.getByRole('button', { name: `Show fewer ${name}` })).toBeVisible();
	}
}
