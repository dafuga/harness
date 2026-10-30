import { expect, type Locator } from '@playwright/test';
import { prepareEntityStates } from './entityStatesPreviewAssertions';
import { prepareContractTableState } from './contractTablePreviewAssertions';
import { prepareUsageLink, prepareUsagePopover } from './usageLinkPreviewAssertions';
import { prepareConfigValueTree } from './configValueTreePreviewAssertions';
import { prepareCatalogItems } from './catalogItemsPreviewAssertions';
import { prepareDependencies } from './dependenciesPreviewAssertions';
import { prepareEvidenceGrid } from './evidenceGridActions';
import { preparePlatforms } from './platformsPreviewAssertions';
import { preparePlatformDetails } from './platformDetailsPreviewAssertions';
import { prepareTranslations } from './translationsPreviewAssertions';
import { prepareModuleState } from './modulePreviewAssertions';
import { preparePermissionState } from './permissionPreviewAssertions';
import { prepareImageZoom } from './imageZoomActions';

import { prepareEvidenceProvenance } from './evidenceProvenanceActions';
import { prepareBrowserErrors } from './browserErrorsActions';
import { prepareEvidenceViewer } from './evidenceViewerActions';

const actions: Record<string, (component: Locator, variant: string) => Promise<void>> = {
	'reports.component.entity-states': prepareEntityStates,
	'reports.component.contract-table': prepareContractTableState,

	'reports.component.activity-list': prepareActivityList,
	'reports.component.explorer-usage-link': prepareUsageLink,
	'reports.component.explorer-usage': prepareUsagePopover,

	'reports.component.explorer-ui-explorer-module-card': prepareUsagePopover,
	'reports.component.explorer-ui-config-value-tree': prepareConfigValueTree,
	'reports.component.explorer-catalog-items': prepareCatalogItems,
	'reports.component.explorer-dependencies-screen': prepareDependencies,
	'reports.component.evidence-grid': prepareEvidenceGrid,

	'reports.component.recorded-value': prepareRecordedValue,

	'reports.component.image-zoom': prepareImageZoom,

	'reports.component.evidence-provenance': prepareEvidenceProvenance,
	'reports.component.browser-errors': prepareBrowserErrors,

	'reports.component.evidence-viewer': prepareEvidenceViewer,

	'reports.component.explorer-ui-explorer-platforms': preparePlatforms,
	'reports.component.explorer-ui-explorer-platform-details': preparePlatformDetails,
	'reports.component.explorer-ui-explorer-translations-screen': prepareTranslations,
	'reports.component.module-system-explorer-module-resources-screen': prepareModuleState,
	'reports.component.module-system-explorer-modules-screen': prepareModuleState,
	'reports.component.networking-security-explorer-permissions-screen': preparePermissionState
};

/** Open report examples through their actual controls before a capture. */
export async function prepareReportState(component: Locator, id: string, variant: string) {
	const action = actions[id];
	if (!action) return false;
	await action(component, variant);
	return true;
}

async function prepareActivityList(component: Locator, variant: string) {
	const list = component.getByRole('list', { name: 'Recent activity', exact: true });
	if (variant === 'empty') {
		await expect(component.getByRole('status')).toHaveText('No activities.');
		await expect(list.locator('li')).toHaveCount(0);
		return;
	}
	if (variant === 'expanded') {
		await component.getByRole('button', { name: 'Show all 4 activities' }).click();
		await expect(component.getByRole('button', { name: 'Show fewer activities' })).toBeVisible();
	}
	if (variant === 'short') await expect(list.locator('li:visible')).toHaveCount(2);
	if (variant === 'ordered') expect(await list.evaluate((node) => node.tagName)).toBe('OL');
	if (variant === 'error') await expect(list.getByRole('alert')).toContainText('Please try again.');
}

async function prepareRecordedValue(component: Locator, variant: string) {
	const notices: Record<string, string> = {
		absent: 'Not recorded',
		'empty-text': 'Empty text',
		'empty-list': 'Empty list',
		'empty-object': 'Empty object'
	};
	if (notices[variant])
		await expect(component.getByText(notices[variant], { exact: true })).toBeVisible();
	if (variant === 'table' || variant === 'many-rows')
		await expect(component.getByRole('region', { name: 'Recorded rows' })).toBeVisible();
	if (variant === 'long-text' || variant === 'custom-label')
		await expect(component.getByText(/Preview shortened/)).toBeVisible();
}
