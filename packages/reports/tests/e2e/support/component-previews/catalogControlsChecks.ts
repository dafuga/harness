import type { CatalogCheckContext } from './catalogChecks.types';
import { expect } from '../../../../../../test/support/browserTest';
import * as caseAssertions from './catalogCaseAssertions';

export async function assertCatalogControls({
	component,
	unit,
	variant,
	viewport
}: CatalogCheckContext) {
	for (const field of await component
		.locator(':is(.hx-revision, .hc-controls) .has-display select')
		.all()) {
		await expect(field, 'The full revision remains available as a title').toHaveAttribute(
			'title',
			/\S/
		);
		await expect(field, 'Only the compact value is painted in a closed revision field').toHaveCSS(
			'color',
			'rgba(0, 0, 0, 0)'
		);
	}
	await caseAssertions.assertCatalogLayout(component, unit, viewport);
	await caseAssertions.assertCatalogDetails(component, unit.id, variant);
	if (
		['remote-connection', 'remote-host-panel', 'remote-offer-code'].some(
			(name) => unit.id === `desktop.component.${name}`
		)
	)
		await expect(component.getByText('Expires in 5:00', { exact: true })).toBeVisible();
	if (unit.id === 'desktop.component.agent-controls' && !variant) {
		const provider = component
			.getByRole('group', { name: 'Agent', exact: true })
			.getByRole('button');
		await expect(provider).toHaveText('Codex');
		const colors = await provider.evaluate((node) => {
			const style = getComputedStyle(node);
			return { text: style.color, background: style.backgroundColor };
		});
		expect(colors.text, 'The provider label must remain readable').not.toBe(colors.background);
	}
	if (unit.id === 'desktop.component.relationships-panel')
		await expect(component.locator('.chip')).toHaveText(['Page', 'Layout']);
	if (unit.id === 'reports.component.provider-picker-cards' && !variant) {
		await expect(component.getByText('GPT 6.1', { exact: true })).toBeVisible();
		await expect(component.getByText('Claude Opus 5.5', { exact: true })).toBeVisible();
	}
	if (unit.id === 'reports.component.harness-explorer-page-card') {
		await expect(component.locator('article')).toHaveCSS('display', 'grid');
		await expect(component.locator('img')).toHaveCSS('object-fit', 'contain');
		await expect(component.locator('img')).toHaveAttribute('src', /synthetic-card-input\.svg$/);
		await expect(
			component.getByRole('link', { name: 'Open OrderCard', exact: true })
		).toHaveAttribute('title', /Synthetic preview input/);
	}
}
