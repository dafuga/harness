import { expect, type Locator } from '@playwright/test';
import { assertFunctionCardState } from './functionCardPreviewAssertions';
import { assertExplorerUsageState } from './explorerUsagePreviewAssertions';
import { assertEntityStates } from './entityStatesPreviewAssertions';
import { assertUsageLink } from './usageLinkPreviewAssertions';
import { assertConfigValueTree } from './configValueTreePreviewAssertions';
import { assertCatalogItems } from './catalogItemsPreviewAssertions';
import { assertUsageExamples } from './usageExamplesPreviewAssertions';
import { assertDependenciesState } from './dependenciesPreviewAssertions';
import { assertRegressionProofState } from './regressionProofPreviewAssertions';
import { assertPlatformDetails } from './platformDetailsPreviewAssertions';
import { assertPlatforms } from './platformsPreviewAssertions';

const checks: Record<string, (component: Locator, variant: string) => Promise<void>> = {
	'reports.component.analytics-filters': assertAnalyticsFilters,
	'reports.component.regression-proof': assertRegressionProofState,
	'reports.component.explorer-function-card': assertFunctionCardState,
	'reports.component.explorer-usage': assertExplorerUsageState,
	'reports.component.entity-states': assertEntityStates,
	'reports.component.explorer-usage-link': assertUsageLink,
	'reports.component.explorer-ui-config-value-tree': assertConfigValueTree,
	'reports.component.explorer-catalog-items': assertCatalogItems,
	'reports.component.usage-examples-usage-examples': assertUsageExamples,
	'reports.component.explorer-dependencies-screen': assertDependenciesState,
	'reports.component.explorer-ui-explorer-platform-details': assertPlatformDetails,
	'reports.component.explorer-ui-explorer-platforms': assertPlatforms
};

/** Run only the checks belonging to this report preview. */
export async function assertSpecialReportState(component: Locator, id: string, variant: string) {
	const check = checks[id];
	if (!check) return false;
	await check(component, variant);
	return true;
}

async function assertAnalyticsFilters(component: Locator, variant: string) {
	const expected =
		variant === 'empty'
			? ['', '', '', '', '']
			: variant === 'all-filters'
				? ['release-check', 'verify', 'GPT 6.1', '2026-10-20', '2026-10-26']
				: ['release-check', '', '', '2026-10-20', ''];
	for (const [index, name] of ['loop', 'task', 'model', 'since', 'until'].entries())
		await expect(component.locator(`input[name="${name}"]`)).toHaveValue(expected[index]);
}
