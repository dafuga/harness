import type { Locator } from '@playwright/test';
import { prepareEntityStates } from './entityStatesPreviewAssertions';
import { prepareUsageLink } from './usageLinkPreviewAssertions';
import { prepareConfigValueTree } from './configValueTreePreviewAssertions';
import { prepareCatalogItems } from './catalogItemsPreviewAssertions';
import { prepareDependencies } from './dependenciesPreviewAssertions';
import { prepareEvidenceGrid } from './evidenceGridActions';
import { preparePlatforms } from './platformsPreviewAssertions';
import { prepareTranslations } from './translationsPreviewAssertions';

const actions: Record<string, (component: Locator, variant: string) => Promise<void>> = {
	'reports.component.entity-states': prepareEntityStates,
	'reports.component.explorer-usage-link': prepareUsageLink,
	'reports.component.explorer-ui-config-value-tree': prepareConfigValueTree,
	'reports.component.explorer-catalog-items': prepareCatalogItems,
	'reports.component.explorer-dependencies-screen': prepareDependencies,
	'reports.component.evidence-grid': prepareEvidenceGrid,
	'reports.component.explorer-ui-explorer-platforms': preparePlatforms,
	'reports.component.explorer-ui-explorer-translations-screen': prepareTranslations
};

/** Open report examples through their actual controls before a capture. */
export async function prepareReportState(component: Locator, id: string, variant: string) {
	const action = actions[id];
	if (!action) return false;
	await action(component, variant);
	return true;
}
