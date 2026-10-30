import { expect, type Locator } from '@playwright/test';
import { assertFunctionCardState } from './functionCardPreviewAssertions';
import { assertExplorerUsageState } from './explorerUsagePreviewAssertions';
import { assertEntityStates } from './entityStatesPreviewAssertions';
import { assertRegressionProofState } from './regressionProofPreviewAssertions';
import { assertUsageLink } from './usageLinkPreviewAssertions';
import { assertConfigValueTree } from './configValueTreePreviewAssertions';
import { assertCatalogItems } from './catalogItemsPreviewAssertions';
import { assertUsageExamples } from './usageExamplesPreviewAssertions';
import { assertDependenciesState } from './dependenciesPreviewAssertions';

/** Check that each additional report preview actually renders its distinct state. */
export async function assertReportPreviewState(component: Locator, id: string, variant = '') {
	if (id === 'reports.component.analytics-filters') {
		const expected =
			variant === 'empty'
				? ['', '', '', '', '']
				: variant === 'all-filters'
					? ['release-check', 'verify', 'GPT 6.1', '2026-10-20', '2026-10-26']
					: ['release-check', '', '', '2026-10-20', ''];
		for (const [index, name] of ['loop', 'task', 'model', 'since', 'until'].entries())
			await expect(component.locator(`input[name="${name}"]`)).toHaveValue(expected[index]);
	}
	if (id === 'reports.component.regression-proof')
		return assertRegressionProofState(component, variant);
	if (id === 'reports.component.explorer-function-card')
		return assertFunctionCardState(component, variant);
	if (id === 'reports.component.explorer-usage')
		return assertExplorerUsageState(component, variant);
	if (id === 'reports.component.entity-states') return assertEntityStates(component, variant);
	if (id === 'reports.component.explorer-usage-link') return assertUsageLink(component, variant);
	if (id === 'reports.component.explorer-ui-config-value-tree')
		return assertConfigValueTree(component, variant);
	if (id === 'reports.component.explorer-catalog-items')
		return assertCatalogItems(component, variant);
	if (id === 'reports.component.usage-examples-usage-examples')
		return assertUsageExamples(component, variant);
	if (id === 'reports.component.explorer-dependencies-screen')
		return assertDependenciesState(component, variant);
	if (id === 'reports.component.modal' && variant === 'image') {
		const dialog = component.getByRole('dialog', { name: 'Order card evidence' });
		await expect(dialog).toBeVisible();
		await expect(dialog).not.toHaveClass(/\b(?:text|lightbox)\b/);
		await expect(dialog.getByRole('img', { name: 'Synthetic order card evidence' })).toBeVisible();
	}
	if (!id.startsWith('reports.component.source-')) return;
	if (id === 'reports.component.source-file-list' && variant !== 'empty')
		await expect(component.getByRole('button', { name: 'View code', exact: true })).toHaveCount(2, {
			timeout: 1_000
		});
	if (
		!variant &&
		['source-content', 'source-dialog', 'source-viewer'].some((name) => id.endsWith(name))
	) {
		const code = component.locator('.source-code');
		await expect(code).toBeVisible();
		const fits = await code.evaluate((node) => node.scrollWidth <= node.clientWidth);
		expect(fits, 'Representative source fits without horizontal clipping').toBe(true);
	}
	if (variant === 'loading-file') {
		await expect(component.getByRole('combobox', { name: 'Source file' })).toBeVisible();
		await expect(component.getByRole('status')).toHaveText('Loading source…');
	}
	if (variant === 'loading-list') {
		await expect(component.getByRole('combobox', { name: 'Source file' })).toHaveCount(0);
		await expect(component.getByRole('status')).toHaveText('Loading source…');
	}
	if (variant === 'list-error') {
		await expect(component.getByRole('combobox', { name: 'Source file' })).toHaveCount(0);
		await expect(component.getByRole('alert')).toContainText('file list is unavailable');
	}
	if (variant === 'empty-file') {
		const pre = component.locator('.source-code');
		await expect(pre).toBeVisible();
		await expect(pre.locator('code')).toHaveText('');
	}
}
