import type { CatalogCheckContext } from './catalogChecks.types';
import { assertPluginKitPreview } from './pluginKitPreviewAssertions';
import { expect, test } from '../../../../../../test/support/browserTest';
import { assertCatalogState } from './previewCaptureAssertions';
import { assertPermissionPanelStyles } from './permissionPreviewAssertions';
import { assertMobileContractFields } from './entityContractPreviewAssertions';
import { assertModuleCardPreview as assertCard } from './moduleCardPreviewAssertions';
import { assertProjectAgentState } from './projectAgentStateAssertions';
import type { ProjectAgentState } from './projectAgentStateFixtures.types';
import { assertReportPreviewState } from './reportPreviewAssertions';
import type { Page, Locator } from '@playwright/test';

export async function assertCatalogBeforeCapture({
	page,
	component,
	unit,
	variant,
	viewport
}: CatalogCheckContext) {
	if (unit.id === 'reports.component.harness-harness-action' && variant === 'long')
		await expect(component.getByRole('link')).toHaveText(
			'Review every recorded result for this selected revision'
		);
	await assertCatalogNames(component, unit.id, variant);
	await assertCatalogState(component, unit.id, variant, viewport.id);
	await assertPluginKitPreview(component, unit.id, variant);
	if (unit.id === 'reports.component.entity-contract' && viewport.id === 'mobile')
		await assertMobileContractFields(component);
	if (unit.id === 'reports.component.explorer-ui-explorer-module-card')
		await test.step('Module card', () => assertCard(component, variant));
	await test.step('Report state', () => assertReportPreviewState(component, unit.id, variant));
	if (
		unit.id === 'reports.component.networking-security-explorer-permissions-screen' &&
		variant.startsWith('endpoint')
	)
		await assertPermissionPanelStyles(component);
	if (unit.id === 'desktop.component.project-agent')
		await assertAgentPreview(page, component, variant);
}

async function assertAgentPreview(page: Page, component: Locator, variant: string) {
	const panel = component.locator('.floating-chat-panel');
	if (variant === 'closed') {
		await expect(component.locator('.floating-chat-bubble')).toBeVisible();
		await expect(panel).toBeHidden();
	} else await expect(panel).toBeVisible();
	await assertProjectAgentState(page, component, (variant || 'rest') as ProjectAgentState);
}

async function assertCatalogNames(component: Locator, id: string, variant: string) {
	if (id.startsWith('desktop.component.') || id.startsWith('hub.component.'))
		await expect(component, 'Catalog identities use realistic names').not.toContainText(
			/A component with a long descriptive name|Preview project|\bAda Example\b/
		);
	if (id !== 'desktop.component.catalog-view' || variant !== 'long') return;
	const title = component.getByRole('heading', {
		name: 'SubscriptionRenewalNotificationPreferencesPanel',
		exact: true
	});
	await expect(title).toBeVisible();
	const fits = await title.evaluate((node) => node.scrollWidth <= node.clientWidth);
	expect(fits, 'The complete long component name wraps within its card').toBe(true);
	const withinCard = await title.evaluate((node) => {
		const card = node.closest('article');
		if (!card) return false;
		const titleBounds = node.getBoundingClientRect();
		const cardBounds = card.getBoundingClientRect();
		return titleBounds.left >= cardBounds.left && titleBounds.right <= cardBounds.right;
	});
	expect.soft(withinCard, 'The long component heading stays inside its card').toBe(true);
}
