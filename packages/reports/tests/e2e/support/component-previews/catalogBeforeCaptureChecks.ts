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
import { assertPlatformsRouteReady } from './platformsPreviewAssertions';
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
	await assertAudioIconState(component, unit.id);
	await assertAccountAndLayoutPreviews(component, unit.id);
	await assertRequiredShellState(component, unit.id, variant);
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

async function assertAccountAndLayoutPreviews(component: Locator, id: string) {
	if (id === 'desktop.component.accounts-access-account-sign-in') {
		const button = component.getByRole('button', { name: 'Sign in with Google' });
		await expect(button).toBeVisible();
		await expect
			.poll(() => button.locator('img').evaluate((image: HTMLImageElement) => image.naturalWidth))
			.toBeGreaterThan(0);
	}
	if (id === 'desktop.layout.root')
		await expect(component.getByText('Child content', { exact: true })).toBeVisible();
	if (id === 'hub.page.accounts-access-devices')
		await expect(component.getByText('This browser', { exact: true })).toBeVisible();
	if (id === 'reports.component.accounts-access-device-list-row') {
		const row = component.getByRole('listitem');
		await expect(row.getByText('Harbor Mac', { exact: true })).toBeVisible();
		await expect(row.getByText('Online', { exact: true })).toBeVisible();
		await expect(row.getByRole('button', { name: 'Connect to Harbor Mac' })).toBeVisible();
	}
	if (id === 'hub.page.public-site-about')
		await expect(component.getByRole('heading', { level: 1 })).toBeVisible();
}

/** Each required prop state joins the normal desktop/tablet/mobile catalog test matrix. */
async function assertRequiredShellState(component: Locator, id: string, variant: string) {
	const state = `${id}:${variant}`;
	if (state === 'reports.page.harness-branch-branch-at-platforms:ready')
		await test.step('Platforms route', () => assertPlatformsRouteReady(component));
	if (state === 'reports.component.harness-entity-relations:both') {
		await expect(component.getByRole('region', { name: 'Used In', exact: true })).toBeVisible();
		await expect(component.getByRole('region', { name: 'Uses', exact: true })).toBeVisible();
	}
	if (state === 'reports.component.harness-harness-action:gold') {
		const action = component.getByRole('link');
		await expect(action).toHaveClass(/\bgold\b/);
		await expect(action).toHaveAttribute('href', /\S+/);
		// Gold is an outline at rest. Its primary fill appears only on hover.
		await expect(action).toHaveCSS('background-color', 'rgba(0, 0, 0, 0)');
		const primary = await action.evaluate((node) => {
			const probe = document.createElement('span');
			probe.style.color = 'var(--hx-color-primary)';
			node.append(probe);
			const value = getComputedStyle(probe).color;
			probe.remove();
			return value;
		});
		await expect(action).toHaveCSS('border-top-color', primary);
	}
	if (state === 'reports.component.harness-harness-header:base') {
		await expect(component.getByRole('heading', { name: 'Harness', exact: true })).toBeVisible();
		// The legacy nav is drawn with no links here; it is present in the DOM but has no box to show.
		const nav = component.getByRole('navigation', { name: 'Other views' });
		await expect(nav).toHaveCount(1);
		await expect(nav.getByRole('link')).toHaveCount(0);
		await expect(component.locator('.hx-navbar')).toHaveCount(0);
	}
	if (state === 'reports.component.harness-harness-verdict:verdict') {
		const mark = component.locator('.hx-verdict');
		await expect(mark).toHaveClass(/\bpassed\b/);
		await expect(mark.getByRole('button')).toHaveAttribute('aria-expanded', 'false');
		await expect(component.locator('.badge')).toHaveCount(0);
	}
	if (state === 'reports.component.harness-harness-verdict:badge') {
		await expect(component.locator('.badge')).toHaveClass(/\bpassed\b/);
		await expect(component.locator('.badge')).toContainText('Passed');
		await expect(component.locator('.badge [aria-hidden="true"]')).toHaveText('●');
		await expect(component.locator('.hx-verdict')).toHaveCount(0);
	}
}

/** The shared speaker retains the original card glyph and caller stylesheet. */
async function assertAudioIconState(component: Locator, id: string) {
	if (id !== 'reports.component.verification-evidence-audio-icon') return;
	const icon = component.locator('.audio-icon');
	await expect(icon).toHaveAttribute('aria-hidden', 'true');
	await expect(icon).toHaveCSS('width', '40px');
	await expect(icon).toHaveCSS('height', '40px');
	await expect(icon.locator('svg')).toHaveAttribute('viewBox', '0 0 24 24');
	await expect(icon.locator('svg')).toHaveAttribute('width', '18');
	await expect(icon.locator('path')).toHaveCount(3);
}
