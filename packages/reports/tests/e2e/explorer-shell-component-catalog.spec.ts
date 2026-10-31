import { assertPresentationPreview } from './support/component-previews/presentationPreviewAssertions';
import {
	assertInlinePluginKitCapture,
	assertPluginKitPreview
} from './support/component-previews/pluginKitPreviewAssertions';
import { assertCompositionFilter } from './support/component-previews/atomicCatalog';
import { dependencyTables } from './support/shellChecks';
import { expect, test } from '../../../../test/support/browserTest';
import { buildShellFixture, removeShellFixture, captureShell } from './support/shellFixture';
import { pictured } from './support/sharedSelect';
import { catalogCases, catalogViewports } from './support/component-previews/catalogUnits';
import * as preview from './support/component-previews/previewPage';
import { profilePreview } from './support/component-previews/profilePreview';
import {
	assertComponentCapture,
	assertCatalogState,
	assertModulePreview,
	assertTranslationControls
} from './support/component-previews/previewCaptureAssertions';
import {
	assertPermissionPanelStyles,
	assertPermissionTable
} from './support/component-previews/permissionPreviewAssertions';
import { assertMobileContractFields } from './support/component-previews/entityContractPreviewAssertions';
import { assertModuleCardPreview as assertCard } from './support/component-previews/moduleCardPreviewAssertions';
import * as picker from './support/component-previews/translationsPreviewAssertions';
import * as caseAssertions from './support/component-previews/catalogCaseAssertions';
import { assertProjectAgentState } from './support/component-previews/projectAgentStateAssertions';
import type { ProjectAgentState } from './support/component-previews/projectAgentStateFixtures.types';
import { prepareCatalogState } from './support/component-previews/catalogStateActions';
import { assertReportPreviewState } from './support/component-previews/reportPreviewAssertions';
import { assertRecordedValueCapture } from './support/component-previews/recordedValueCaptureAssertions';
import { assertShellReview } from './support/component-previews/shellReviewAssertions';
import { documentedStyleTokens, expectColorRoles, expectStyleGroups } from './support/styleCatalog';
import { assertCatalogRegistry } from './support/component-previews/catalogRegistryAssertions';
let home = '';
test.beforeAll(async () => {
	test.setTimeout(180_000);
	assertCatalogRegistry();
	home = buildShellFixture(['catalog']);
});
test.afterAll(() => removeShellFixture(home));
test('every active visual component has its own required capture state', assertCatalogRegistry);
for (const viewport of catalogViewports) {
	for (const stage of ['history', 'revision'] as const) {
		test(`console data loading: ${stage} at ${viewport.id}`, async ({ page }) => {
			const unit = 'reports.component.harness-harness-console';
			await page.setViewportSize(viewport);
			await preview.openPreview(page, home, unit);
			await preview.readyPreview(page, unit);
			let release!: () => void;
			const held = new Promise<void>((resolve) => (release = resolve));
			const path = stage === 'history' ? '**/data/index.json' : '**/data/revisions/*.json';
			await page.route(path, async (route) => {
				await held;
				await route.fallback();
			});
			await page.reload();
			const message = stage === 'history' ? 'Loading history…' : 'Loading this revision…';
			const status = page.getByRole('status').filter({ hasText: message });
			try {
				await expect(status).toBeVisible();
				await pictured(page, `console-loading-${stage}-${viewport.id}`);
				await captureShell(page, home, {
					state: `loading-${stage}`,
					viewport: viewport.id,
					slot: unit
				});
				await expect(
					status.locator('[aria-hidden="true"]'),
					'Loading status has a decorative indicator'
				).toBeVisible();
				const ring = (await status.locator('[aria-hidden="true"]').boundingBox())!;
				expect(Math.abs(ring.x + ring.width / 2 - viewport.width / 2)).toBeLessThanOrEqual(8);
				expect(Math.abs(ring.y + ring.height / 2 - viewport.height / 2)).toBeLessThanOrEqual(8);
				await page.emulateMedia({ reducedMotion: 'reduce' });
				await expect(status.locator('[aria-hidden="true"]')).toHaveCSS('animation-name', 'none');
				await expect
					.poll(() => page.evaluate(() => document.documentElement.scrollWidth))
					.toBeLessThanOrEqual(viewport.width);
			} finally {
				release();
			}
			await preview.readyPreview(page, unit);
			await expect(status).toHaveCount(0);
			await expect(page.getByRole('heading', { level: 1, name: 'Components' })).toBeVisible();
		});
	}
}
for (const viewport of catalogViewports) {
	for (const { unit, variant } of catalogCases) {
		const isProjectAgent = unit.id === 'desktop.component.project-agent';
		const title = `${unit.id}${variant ? `:${variant}` : ''} at ${viewport.id}`;
		test(title, async ({ page, browserErrors }) => {
			picker.expectUploadErrors(unit.id, variant, browserErrors);
			const projectErrors: string[] = [];
			if (unit.id === 'reports.component.console-chat' && variant === 'connection-error')
				browserErrors.expectError({
					type: 'console',
					message:
						'Failed to load resource: the server responded with a status of 503 (Service Unavailable)',
					reason: 'The console connection-error fixture deliberately refuses the connection.'
				});
			if (unit.id === 'reports.component.provider-picker' && variant === 'connection-error') {
				// Desktop profiles six remounts, each exercising the same refused connection.
				for (let attempt = 0; attempt < (viewport.id === 'desktop' ? 7 : 1); attempt++)
					browserErrors.expectError({
						type: 'console',
						message:
							'Failed to load resource: the server responded with a status of 503 (Service Unavailable)',
						reason: 'The picker connection-error fixture deliberately refuses the connection.'
					});
			}
			if (isProjectAgent) {
				page.on('pageerror', (error) => projectErrors.push(error.message));
				page.on('console', (message) => {
					if (message.type() === 'error') projectErrors.push(message.text());
				});
			}
			await page.setViewportSize(viewport);
			await preview.openPreview(page, home, unit.id, variant);
			await expect(page.locator('#preview-title')).toHaveText(unit.title);
			const component = await preview.readyPreview(page, unit.id, variant);
			const target = { viewport: viewport.id, variant };
			const early =
				unit.id === 'reports.component.shared-primitives-atoms-html-a' ||
				(variant === 'empty' &&
					[
						'reports.component.coverage-list',
						'reports.component.module-system-plugins-plugin-steps'
					].includes(unit.id));
			if (early) {
				if (unit.id === 'reports.component.coverage-list')
					await expect(component.getByRole('heading', { name: 'Acceptance' })).toBeVisible();
				await preview.capturePreview(page, home, unit.id, target);
			}
			await test.step('Prepare state', () => prepareCatalogState(component, unit.id, variant));
			if (unit.id === 'reports.component.harness-harness-action' && variant === 'long')
				await expect(component.getByRole('link')).toHaveText(
					'Review every recorded result for this selected revision'
				);
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
			if (isProjectAgent) {
				const panel = component.locator('.floating-chat-panel');
				if (variant === 'closed') {
					await expect(component.locator('.floating-chat-bubble')).toBeVisible();
					await expect(panel).toBeHidden();
				} else await expect(panel).toBeVisible();
				await assertProjectAgentState(page, component, (variant || 'rest') as ProjectAgentState);
			}
			const capture = early ? undefined : await preview.capturePreview(page, home, unit.id, target);
			if (
				unit.id === 'reports.component.explorer-ui-explorer-platforms' &&
				variant === 'status-options-open'
			)
				expect(
					capture,
					'The open status menu is captured before comparing its pixels'
				).toBeDefined();
			await picker.assertOpenPickerPixels(page, unit.id, variant, capture);
			if (unit.id === 'reports.component.image-zoom' && variant === 'dragging')
				await page.mouse.up();
			await assertComponentCapture(page, unit.id, viewport.id, variant);
			await assertShellReview(component, unit.id, variant, viewport.id);
			await assertInlinePluginKitCapture(component, unit.id);
			await assertPresentationPreview(component, unit.id, variant);
			await assertRecordedValueCapture(component, unit.id, variant);
			if (unit.id === 'reports.component.module-system-explorer-modules-screen' && !variant) {
				await expect(component.locator('article')).toHaveCount(6);
				await expect(component.getByText('Testing', { exact: true })).toHaveCount(2);
			}
			await assertModulePreview(component, unit.id, variant);
			if (
				unit.id === 'reports.component.networking-security-explorer-permissions-screen' &&
				['', 'admin', 'gap', 'endpoint'].includes(variant)
			)
				await assertPermissionTable(component, page, viewport.id === 'mobile');
			if (unit.id.endsWith('explorer-index') && !variant) await assertCompositionFilter(component);
			if (
				(unit.id === 'reports.component.explorer-dependencies-screen' && !variant) ||
				unit.id.endsWith('at-dependencies')
			) {
				await dependencyTables(component, page, viewport.width, viewport.id === 'mobile');
			}
			if (
				(unit.id.endsWith('explorer-translations-screen') && !variant) ||
				unit.id.endsWith('at-translations')
			)
				await assertTranslationControls(component);
			if (unit.id === 'reports.component.explorer-ui-harness-explorer-styles-screen') {
				await expectColorRoles(component);
				await expectStyleGroups(component);
				await expect(component.locator('[data-style-token]')).toHaveCount(
					documentedStyleTokens().length
				);
			}
			for (const field of await component.locator('.hx-revision .has-display select').all()) {
				await expect(field, 'The full revision remains available as a title').toHaveAttribute(
					'title',
					/\S/
				);
				await expect(
					field,
					'Only the compact value is painted in a closed revision field'
				).toHaveCSS('color', 'rgba(0, 0, 0, 0)');
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
			await expect
				.poll(() => page.evaluate(() => document.documentElement.scrollWidth))
				.toBeLessThanOrEqual(viewport.width);
			if (viewport.id === 'desktop') await profilePreview(page, unit.id, variant);
			if (isProjectAgent)
				expect(projectErrors, 'ProjectAgent produces no unexpected browser errors').toEqual([]);
		});
	}
}
