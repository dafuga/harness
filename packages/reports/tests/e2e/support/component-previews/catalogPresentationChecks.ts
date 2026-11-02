import type { CatalogCheckContext } from './catalogChecks.types';
import { assertPresentationPreview } from './presentationPreviewAssertions';
import { assertInlinePluginKitCapture } from './pluginKitPreviewAssertions';
import { assertCompositionFilter } from './atomicCatalog';
import { dependencyTables } from '../shellChecks';
import { expect } from '../../../../../../test/support/browserTest';
import {
	assertComponentCapture,
	assertModulePreview,
	assertTranslationControls
} from './previewCaptureAssertions';
import { assertPermissionTable } from './permissionPreviewAssertions';
import { assertRecordedValueCapture } from './recordedValueCaptureAssertions';
import { assertShellReview } from './shellReviewAssertions';
import { assertShellVisualReview } from './shellVisualReviewAssertions';
import { documentedStyleTokens, expectColorRoles, expectStyleGroups } from '../styleCatalog';
import type { Locator } from '@playwright/test';
import type { CatalogUnit, CatalogViewport } from './catalogChecks.types';

export async function assertCatalogPresentation({
	page,
	component,
	unit,
	variant,
	viewport
}: CatalogCheckContext) {
	await assertComponentCapture(page, unit.id, viewport.id, variant);
	await assertShellReview(component, unit.id, variant, viewport.id);
	await assertShellVisualReview(component, unit.id, variant);
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
	await assertCatalogDomains(component, unit, variant, viewport);
}

async function assertCatalogDomains(
	component: Locator,
	unit: CatalogUnit,
	variant: string,
	viewport: CatalogViewport
) {
	if (
		(unit.id === 'reports.component.explorer-dependencies-screen' && !variant) ||
		unit.id.endsWith('at-dependencies')
	) {
		await dependencyTables(component, component.page(), viewport.width, viewport.id === 'mobile');
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
}
