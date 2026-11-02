import type { CatalogCheckContext } from './catalogChecks.types';
import { evidenceRequested } from '../../../../../../src/utils/record-capture/recordCapture';
import { assertRecordedCompatibility } from './compatibilityPreviewAssertions';
import { expect } from '../../../../../../test/support/browserTest';
import * as picker from './translationsPreviewAssertions';
import { assertTabOverflowCue } from './shellVisualReviewAssertions';
import { assertRequiredStateWords } from './shellVisualReviewAssertions';
import { assertViewerReview } from './evidenceViewerActions';
import { assertViewerNavigationAppearance } from './evidenceViewerActions';
import { assertCatalogItemsFrame } from './catalogItemsPreviewAssertions';
import type { Locator } from '@playwright/test';
import type { CatalogUnit, CatalogCapture } from './catalogChecks.types';

export async function assertCatalogAfterCapture({
	page,
	component,
	unit,
	variant,
	viewport,
	capture
}: CatalogCheckContext) {
	assertStatusCapture(unit, variant, capture);
	if (unit.id === 'reports.component.harness-entity-screens' && variant === 'viewer-open')
		await expect(component.getByRole('button', { name: 'View after screenshot' })).toHaveClass(
			/\bactive\b/
		);
	await assertViewerReview(component, unit.id, variant);
	await assertViewerNavigationAppearance(component, unit.id, variant);
	if (unit.id === 'reports.component.evidence-viewer' && variant === 'no-navigation')
		await expect(component.locator('.viewer-actions button[disabled]')).toHaveCount(2);
	if (unit.id === 'reports.component.explorer-catalog-items' && variant === 'configs-open')
		await assertCatalogItemsFrame(component, viewport.id, capture);
	await assertCatalogArtifacts(component, unit, variant);
	await assertOpenedDetails(component, unit, variant, capture);
	await picker.assertOpenPickerPixels(page, unit.id, variant, capture);
	if (unit.id === 'reports.component.image-zoom' && variant === 'dragging') await page.mouse.up();
}

function assertStatusCapture(unit: CatalogUnit, variant: string, capture: CatalogCapture) {
	if (
		evidenceRequested() &&
		unit.id === 'reports.component.harness-harness-verdict' &&
		(variant.endsWith('-open') || (variant.startsWith('icon') && variant !== 'icon'))
	)
		expect(capture, 'Status state capture follows its interaction').toBeDefined();
}

async function assertCatalogArtifacts(component: Locator, unit: CatalogUnit, variant: string) {
	if (
		(unit.id === 'reports.component.harness-entity-sections' && variant === 'tests') ||
		unit.id === 'reports.component.harness-entity-tests'
	)
		await assertRequiredStateWords(component);
	await assertRecordedCompatibility(component, unit.id, variant);
	await assertTabOverflowCue(component, unit.id);
}

async function assertOpenedDetails(
	component: Locator,
	unit: CatalogUnit,
	variant: string,
	capture: CatalogCapture
) {
	if (unit.id === 'reports.component.harness-entity-artifact' && variant === 'raw-open') {
		const original = await component
			.getByRole('link', { name: 'Open the recorded Assertions' })
			.evaluate(async (link: HTMLAnchorElement) => (await fetch(link.href)).text());
		await expect(component.locator('details[open] details[open] pre')).toHaveText(original);
	}
	if (
		unit.id === 'reports.component.explorer-ui-explorer-platforms' &&
		variant === 'status-options-open'
	)
		expect(capture, 'The open status menu is captured before comparing its pixels').toBeDefined();
}
