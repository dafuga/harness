import { expect, test } from '../../../../test/support/browserTest';
import { buildShellFixture, removeShellFixture, captureShell } from './support/shellFixture';
import { pictured } from './support/sharedSelect';
import { catalogCases, catalogViewports } from './support/component-previews/catalogUnits';
import * as preview from './support/component-previews/previewPage';
import { profilePreview } from './support/component-previews/profilePreview';
import { prepareCatalogState } from './support/component-previews/catalogStateActions';
import { assertCatalogRegistry } from './support/component-previews/catalogRegistryAssertions';
import { catalogFixtureMedia } from './support/component-previews/catalogFixtureMedia';
import { assertCatalogFixtureMedia } from './support/component-previews/catalogFixtureAssertions';
import { assertCatalogBeforeCapture } from './support/component-previews/catalogBeforeCaptureChecks';
import { assertCatalogAfterCapture } from './support/component-previews/catalogAfterCaptureChecks';
import { assertCatalogPresentation } from './support/component-previews/catalogPresentationChecks';
import { assertCatalogControls } from './support/component-previews/catalogControlsChecks';
import { catalogExpectedErrors } from './support/component-previews/catalogExpectedErrors';
import { captureCatalogBeforeActions } from './support/component-previews/catalogCaptureTiming';
let home = '';
test.beforeAll(async () => {
	test.setTimeout(180_000);
	assertCatalogRegistry();
	home = buildShellFixture(['catalog']);
	catalogFixtureMedia(home);
});
test.afterAll(() => removeShellFixture(home));
test('every active visual component has its own required capture state', () => {
	assertCatalogRegistry();
	assertCatalogFixtureMedia(home);
});
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
			const projectErrors = catalogExpectedErrors(page, browserErrors, unit.id, {
				variant,
				viewport
			});
			await page.setViewportSize(viewport);
			await preview.openPreview(page, home, unit.id, variant);
			await expect(page.locator('#preview-title')).toHaveText(unit.title);
			const component = await preview.readyPreview(page, unit.id, variant);
			const target = { viewport: viewport.id, variant };
			const context = { page, component, unit, variant, viewport };
			const early = await captureCatalogBeforeActions(context, home);
			await test.step('Prepare state', () => prepareCatalogState(component, unit.id, variant));
			await assertCatalogBeforeCapture(context);
			const capture = early ? undefined : await preview.capturePreview(page, home, unit.id, target);
			await assertCatalogAfterCapture({ ...context, capture });
			await assertCatalogPresentation(context);
			await assertCatalogControls(context);
			await expect
				.poll(() => page.evaluate(() => document.documentElement.scrollWidth))
				.toBeLessThanOrEqual(viewport.width);
			if (viewport.id === 'desktop') await profilePreview(page, unit.id, variant);
			if (isProjectAgent)
				expect(projectErrors, 'ProjectAgent produces no unexpected browser errors').toEqual([]);
		});
	}
}
