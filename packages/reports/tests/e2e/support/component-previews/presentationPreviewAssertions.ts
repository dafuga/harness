import {
	prepareCompatibilityState,
	assertCompatibilityPreview
} from './compatibilityPreviewAssertions';
import { expect, type Locator } from '@playwright/test';

const prefix = 'reports.component.shared-primitives-';
/** The normal catalog owns focus, scrolling and inspection states for presentation primitives. */
export async function preparePresentationState(component: Locator, id: string, variant: string) {
	await prepareCompatibilityState(component, id, variant);
	if (id === `${prefix}data-table` && variant === 'focused')
		await component.getByRole('region', { name: 'Contract fields' }).focus();
	if (id === `${prefix}code-line` && variant === 'action-focused')
		await component.getByRole('button', { name: 'Inspect full source' }).focus();
	if (id === `${prefix}code-line` && variant === 'inspection-open')
		await component.getByRole('button', { name: 'Inspect full source' }).click();
	if (id === 'desktop.component.contract-panel' && variant === 'technical-open')
		await component.locator('summary').click();
}

export async function assertPresentationPreview(component: Locator, id: string, variant: string) {
	const checks: Record<string, (component: Locator, variant: string) => Promise<void>> = {
		[`${prefix}data-table`]: table,
		[`${prefix}code-line`]: code,
		[`${prefix}detail-list`]: details,
		'desktop.component.contract-panel': contract,
		'reports.component.harness-explorer-table': explorer
	};
	await checks[id]?.(component, variant);
	await assertCompatibilityPreview(component, id, variant);
}

async function table(component: Locator, variant: string) {
	const region = component.getByRole('region', { name: 'Contract fields' });
	await expect(region.getByRole('table', { name: 'Contract fields' })).toBeVisible();
	await expect(component.locator('thead th')).toHaveText(['Name', 'Type']);
	if (variant === 'empty') await expect(component).toContainText('No fields recorded.');
	if (variant === 'focused') await expect(region).toBeFocused();
	if (variant !== 'long') return;
	expect(await region.evaluate((node) => node.scrollWidth > node.clientWidth)).toBe(true);
	const type = component.locator('tbody td').first();
	expect(await type.evaluate((node) => node.scrollWidth <= node.clientWidth)).toBe(true);
	await region.focus();
	await region.press('ArrowRight');
	await expect.poll(() => region.evaluate((node) => node.scrollLeft)).toBeGreaterThan(0);
}

async function code(component: Locator, variant: string) {
	const line = component.locator('.code-line code').first();
	await expect(line).toHaveAttribute('title', (await line.textContent()) ?? '');
	if (variant === 'wrap') await expect(line).toHaveCSS('white-space', 'pre-wrap');
	else await expect(line).toHaveCSS('white-space', 'nowrap');
	if (variant === 'long')
		expect(await line.evaluate((node) => node.scrollWidth > node.clientWidth)).toBe(true);
	if (variant === 'action-focused')
		await expect(component.getByRole('button', { name: 'Inspect full source' })).toBeFocused();
	if (variant !== 'inspection-open') return;
	await expect(component.getByRole('dialog', { name: 'Full source' })).toBeVisible();
	await component.getByRole('dialog').press('Escape');
	await expect(component.getByRole('dialog')).toBeHidden();
	await expect(component.getByRole('button', { name: 'Inspect full source' })).toBeFocused();
}

async function details(component: Locator, variant: string) {
	if (variant === 'empty') {
		await expect(component).toContainText('No details provided.');
		await expect(component.locator('dl')).toHaveCount(0);
		return;
	}
	const terms = component.locator('dt');
	const values = component.locator('dd');
	await expect(values).toHaveCount(await terms.count());
	if (variant === 'values')
		await expect(values).toHaveText(['Not recorded', 'false', '0', 'Empty string']);
	if (variant === 'duplicate-labels') await expect(terms).toHaveText(['Source', 'Source']);
}

async function contract(component: Locator, variant: string) {
	await expect(component.getByRole('heading', { name: 'Contract', exact: true })).toBeVisible();
	if (variant === 'empty') await expect(component.getByText('Nothing declared.')).toHaveCount(3);
	if (variant === 'missing-description')
		await expect(component.getByText('No description recorded.').first()).toBeVisible();
	if (variant === 'technical-open')
		await expect(component.locator('details')).toHaveAttribute('open', '');
}

async function explorer(component: Locator, variant: string) {
	const table = component.getByRole('table');
	await expect(table).toBeVisible();
	if (!variant || variant === 'empty')
		await expect(table.locator('thead th')).toHaveText(['Variable', 'Value']);
	if (variant === 'empty') await expect(table.locator('tbody tr')).toHaveCount(0);
}
