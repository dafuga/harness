import { expect, type Locator } from '@playwright/test';
import { prepareEntityStates } from './entityStatesPreviewAssertions';
import { prepareUsageLink, prepareUsagePopover } from './usageLinkPreviewAssertions';
import { prepareConfigValueTree } from './configValueTreePreviewAssertions';
import { prepareCatalogItems } from './catalogItemsPreviewAssertions';
import { prepareDependencies } from './dependenciesPreviewAssertions';
import { prepareEvidenceGrid } from './evidenceGridActions';
import { preparePlatforms } from './platformsPreviewAssertions';
import { prepareTranslations } from './translationsPreviewAssertions';
import { prepareImageZoom } from './imageZoomActions';
import { prepareCoverageList } from './coverageListActions';
import { prepareUploadComparison } from './uploadComparisonActions';
import { prepareReportFindings } from './reportFindingsActions';

const actions: Record<string, (component: Locator, variant: string) => Promise<void>> = {
	'reports.component.entity-states': prepareEntityStates,
	'reports.component.analytics-history': prepareAnalyticsHistory,
	'reports.component.activity-list': prepareActivityList,
	'reports.component.explorer-usage-link': prepareUsageLink,
	'reports.component.explorer-usage': prepareUsagePopover,
	'reports.component.explorer-function-card': prepareUsagePopover,
	'reports.component.explorer-ui-explorer-module-card': prepareUsagePopover,
	'reports.component.explorer-ui-config-value-tree': prepareConfigValueTree,
	'reports.component.explorer-catalog-items': prepareCatalogItems,
	'reports.component.explorer-dependencies-screen': prepareDependencies,
	'reports.component.evidence-grid': prepareEvidenceGrid,
	'reports.component.report-checks': prepareReportChecks,
	'reports.component.recorded-value': prepareRecordedValue,
	'reports.component.report-summary': prepareReportSummary,
	'reports.component.image-zoom': prepareImageZoom,
	'reports.component.coverage-list': prepareCoverageList,
	'reports.component.upload-comparison': prepareUploadComparison,
	'reports.component.report-findings': prepareReportFindings,
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

async function prepareAnalyticsHistory(component: Locator, variant: string) {
	if (variant === 'empty') {
		await expect(component.getByText('No loops recorded in this view.')).toBeVisible();
		return;
	}
	const table = component.getByRole('table');
	const scroll = table.locator('..');
	expect(
		await scroll.evaluate((node) => node.scrollWidth <= node.clientWidth),
		'History table fits its available width'
	).toBe(true);
	const cells = table.locator('tbody tr').first().locator('td');
	await expect(cells).toHaveCount(8);
	if (variant === 'active') await expect(cells.nth(3)).toHaveText('active');
	if ((component.page().viewportSize()?.width ?? 0) > 832) return;
	const labels = [
		'Loop',
		'Template',
		'Agent model',
		'Status',
		'Created',
		'Completed',
		'Duration',
		'Evaluations'
	];
	for (let index = 0; index < labels.length; index++) {
		await expect(cells.nth(index)).toHaveAttribute('data-label', labels[index]);
		expect(
			await cells.nth(index).evaluate((node) => getComputedStyle(node, '::before').content),
			'History labels remain visible at compact widths'
		).toBe(`"${labels[index]}"`);
	}
}

async function prepareReportChecks(component: Locator, variant: string) {
	if (variant.endsWith('empty')) {
		await expect(component.getByText('No checks recorded yet.')).toBeVisible();
		await expect(component.locator('article.check')).toHaveCount(0);
		return;
	}
	await expect(component.locator('article.check')).toHaveCount(variant === 'multiple' ? 3 : 1);
	await expect(component.getByText('Checkout confirmation')).toBeVisible();
	if (variant.endsWith('open')) {
		const details = component.locator('details').first();
		await details.locator('summary').click();
		await expect(details).toHaveAttribute('open', '');
		if (variant !== 'output-open') await expect(details.locator('code')).toContainText('checkout');
		if (variant !== 'command-open') await expect(details).toContainText('12 passed');
	}
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

async function prepareReportSummary(component: Locator, variant: string) {
	await expect(
		component.getByRole('heading', { name: 'Checkout release verification' })
	).toBeVisible();
	if (variant.endsWith('open')) {
		const details = component.locator('details.run-details');
		await details.locator('summary').click();
		await expect(details).toHaveAttribute('open', '');
		if (variant === 'run-open')
			await expect(details.getByRole('link', { name: /Download everything/ })).toBeVisible();
		if (variant === 'portable-open')
			await expect(details.getByRole('link', { name: /Download everything/ })).toHaveCount(0);
	}
	if (variant === 'stale')
		await expect(component.getByText(/No updates for over 15 minutes/)).toBeVisible();
	if (variant === 'gaps') await expect(component.locator('.gap-count')).toContainText('2 gaps');
}
