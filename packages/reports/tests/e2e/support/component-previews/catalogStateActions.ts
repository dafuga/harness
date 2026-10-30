import { expect, type Locator, type Page } from '@playwright/test';
import { prepareConsoleChatState } from './consoleChatActions';
import { assertProviderPickerCardState } from './providerPickerCardActions';
import { prepareProviderPickerState } from './providerPickerActions';
import { prepareActivityWorkState } from './activityWorkActions';
import { prepareActivityFileState } from './activityFileActions';
import { prepareAudioEvidence } from './audioEvidenceActions';
import { prepareAudioUploadFiles } from './audioUploadFilesActions';
import { prepareEntitySearchState } from './entitySearchPreviewActions';
import { prepareEvidenceCard } from './evidenceCardActions';
import { prepareReportState } from './reportStateActions';

type CatalogStateAction = (component: Locator) => Promise<void>;

const actions: Record<string, CatalogStateAction> = {
	'reports.component.floating-chat:closed': async (component) => {
		await expect(component.locator('.floating-chat-bubble')).toBeVisible();
		await expect(component.locator('.floating-chat-panel')).toHaveCount(0);
	},
	'reports.component.floating-chat:notice': async (component) => {
		await expect(
			component.getByText('Agent suggestions appear when a provider connects.')
		).toBeVisible();
	},
	'reports.component.floating-chat:navigation': async (component) => {
		await expect(component.getByRole('navigation', { name: 'Project chat' })).toBeVisible();
	},
	'reports.component.floating-chat:following': async (component) => {
		await expect
			.poll(() => component.locator('.floating-chat-body').evaluate((node) => node.scrollTop))
			.toBeGreaterThan(0);
	},
	'reports.component.floating-chat:not-following': async (component) => {
		await expect
			.poll(() => component.locator('.floating-chat-body').evaluate((node) => node.scrollTop))
			.toBe(0);
	},
	'reports.component.project-activity:stale': async (component) => {
		await expect(component.getByText(/The last reading is older than a minute/)).toBeVisible();
	},
	'reports.component.project-activity:failed-read': async (component) => {
		await expect(component.getByRole('status')).toContainText('Activity could not be read again');
	},
	'reports.component.analytics-tasks:unassessed': async (component) => {
		await expect(component.getByRole('cell', { name: 'Not assessed' })).toBeVisible();
	},
	'reports.component.analytics-tasks:unpassed': async (component) => {
		await expect(component.getByRole('cell', { name: 'Not yet passed' })).toBeVisible();
	},
	'reports.component.analytics-tasks:retried': async (component) => {
		await expect(component.getByRole('link', { name: 'View report' })).toBeVisible();
	},
	'reports.component.audio-comparison-viewer:before': async (component) => {
		await component.getByRole('button', { name: 'View before recording' }).click();
		await expect(component.getByRole('group', { name: 'Before recording' })).toBeVisible();
	},
	'reports.component.audio-comparison-viewer:after': async (component) => {
		await component.getByRole('button', { name: 'View after recording' }).click();
		await expect(component.getByRole('group', { name: 'After recording' })).toBeVisible();
	},
	'reports.component.audio-comparison-viewer:transcript-closed': async (component) => {
		await component.getByRole('button', { name: 'View before recording' }).click();
		for (const details of await component.locator('.audio-details').all()) {
			await details.locator('summary').click();
			await expect(details).not.toHaveAttribute('open');
		}
	},
	'reports.component.audio-comparison-viewer:playing-before': async (component) => {
		await playRecording(component, 'Before');
	},
	'reports.component.audio-comparison-viewer:playing-after': async (component) => {
		await playRecording(component, 'After');
	},
	'reports.component.activity-work:recorded': async (component) => {
		const detail = component.locator('details').first();
		await detail.locator('summary').click();
		await expect(detail).toContainText('accepted by its records');
	},
	'reports.component.site-activity:failed-refresh': async (component) => {
		await component.getByRole('button', { name: 'Refresh activity' }).click();
		await expect(component.getByRole('status')).toContainText('Activity could not be read again');
	},
	'reports.component.evidence-grid:empty': async (component) => {
		await component
			.getByRole('textbox', { name: 'Search screenshots, audio and transcripts' })
			.fill('no-match');
		await expect(component.getByText('No matching evidence.', { exact: true })).toBeVisible();
	},
	'reports.component.evidence-grid:audio': async (component) => {
		await component
			.locator('.media-tabs')
			.getByRole('button', { name: /^Audio/ })
			.click();
		await expect(component.getByText('Release narration', { exact: true })).toBeVisible();
	},
	'reports.component.evidence-grid:image-open': async (component) => {
		await component.getByRole('button', { name: 'Open Synthetic preview input' }).first().click();
		await expect(component.getByRole('dialog')).toBeVisible();
	},
	'reports.component.evidence-viewer:before': async (component) => {
		await component.getByRole('button', { name: 'View before screenshot' }).click();
		await expect(component.getByRole('heading', { name: 'Checkout before release' })).toBeVisible();
	},
	'reports.component.evidence-viewer:compare': async (component) => {
		await component.getByRole('button', { name: 'Compare before and after' }).click();
		await expect(component.locator('.viewer-images.comparison figure')).toHaveCount(2);
	},
	'reports.component.regression-proof:output-open': async (component) => {
		await component.locator('summary').click();
		await expect(component.getByText('harness verify run', { exact: true })).toBeVisible();
	},
	'reports.component.entity-cases:expanded': async (component) => {
		await component.locator('.cases > details > summary').click();
		await expect(component.locator('.cases > details > pre')).toContainText('Format a duration');
	},
	'reports.component.entity-contract:example-open': async (component) => {
		await component.getByRole('button', { name: 'View example for Orders' }).click();
		await expect(component.getByRole('dialog', { name: 'Example for Orders' })).toBeVisible();
	},
	'reports.component.contract-example:structure-open': async (component) => {
		await component.getByText('Full example as JSON', { exact: true }).click();
		await expect(component.locator('details[open] pre')).toContainText('A-1048');
	},
	'reports.component.filter-dialog:open': async (component) => {
		await component.getByRole('button', { name: 'Filters', exact: true }).click();
		await expect(component.getByRole('dialog', { name: 'Filters', exact: true })).toBeVisible();
	},
	'reports.component.select:display': async (component) => {
		const label = component.locator('.report-select-value');
		await expect(label).toHaveText('releas…proval');
		expect(await label.evaluate((node) => node.scrollWidth <= node.clientWidth)).toBe(true);
	},
	'reports.component.select:open': async (component) => {
		const select = component.getByRole('combobox', { name: 'Viewport', exact: true });
		await select.click();
		await expect.poll(() => select.evaluate((node) => node.matches(':open'))).toBe(true);
	}
};

/** Reproduce catalog variants that are reached through the component's own controls. */
export async function prepareCatalogState(component: Locator, id: string, variant: string) {
	if (id === 'reports.component.activity-files') await prepareActivityFileState(component, variant);
	if (id === 'reports.component.activity-work' && variant !== 'recorded')
		await prepareActivityWorkState(component, variant);
	if (await prepareReportState(component, id, variant)) return;
	if (id === 'reports.component.entity-search' && variant)
		return prepareEntitySearchState(component, variant);
	if (id === 'reports.component.provider-picker')
		return prepareProviderPickerState(component, variant);
	if (id === 'reports.component.console-chat' && variant)
		return prepareConsoleChatState(component, variant);
	if (id === 'reports.component.provider-picker-cards' && variant)
		return assertProviderPickerCardState(component, variant);
	if (id === 'reports.component.audio-comparison') await assertAudioComparison(component, variant);
	if (id === 'reports.component.audio-evidence') return prepareAudioEvidence(component, variant);
	if (id === 'reports.component.audio-upload-files')
		return prepareAudioUploadFiles(component, variant);
	if (id === 'reports.component.evidence-card') return prepareEvidenceCard(component, variant);
	const action = actions[`${id}:${variant}`];
	if (action) await action(component);
	if (id === 'reports.component.audio-comparison-viewer')
		await assertAudioComparisonViewer(component, variant);
}

async function assertAudioComparison(component: Locator, variant: string) {
	const rows = component.locator('.audio-comparison-row');
	await expect(rows).toHaveCount(2);
	const missing = variant === 'both-unavailable' ? 2 : variant.includes('unavailable') ? 1 : 0;
	await expect(component.locator('.audio-comparison-missing')).toHaveCount(missing);
	if (variant === 'no-duration') await expect(component.locator('.audio-duration')).toHaveCount(0);
	if (variant === 'mixed') {
		await expect(rows.nth(0).locator('.badge')).toHaveClass(/failed/);
		await expect(rows.nth(1).locator('.badge')).toHaveClass(/passed/);
	}
	if (['running', 'failed', 'blocked', 'skipped', 'not-proven', 'interrupted'].includes(variant))
		await expect(rows.nth(1).locator('.badge')).toHaveClass(new RegExp(variant));
}

async function playRecording(component: Locator, phase: string) {
	const playing = component.getByRole('group', { name: `${phase} recording` }).locator('audio');
	await playing.evaluate((audio: HTMLAudioElement) => audio.play());
	await expect.poll(() => playing.evaluate((audio: HTMLAudioElement) => audio.paused)).toBe(false);
}

async function assertAudioComparisonViewer(component: Locator, variant: string) {
	const sides = component.locator('.audio-comparison-side');
	await expect(sides).toHaveCount(
		['before', 'after', 'transcript-closed'].includes(variant) ? 1 : 2
	);
	const missing = variant === 'both-unavailable' ? 2 : variant.includes('unavailable') ? 1 : 0;
	await expect(component.locator('.audio-card.unavailable')).toHaveCount(missing);
	if (variant === 'no-duration') await expect(component.locator('.audio-duration')).toHaveCount(0);
	if (variant === 'mixed') {
		await expect(sides.nth(0).locator('.badge')).toHaveClass(/failed/);
		await expect(sides.nth(1).locator('.badge')).toHaveClass(/passed/);
	}
	if (['running', 'failed', 'blocked', 'skipped', 'not-proven', 'interrupted'].includes(variant))
		await expect(sides.nth(1).locator('.badge')).toHaveClass(new RegExp(variant));
}

/** Assert the complete comparison after its screenshot is recorded. */
export async function assertAudioViewerCapture(page: Page, id: string, viewport: string) {
	if (id !== 'reports.component.audio-comparison-viewer' || viewport !== 'mobile') return;
	const component = page.locator(`[data-preview-unit="${id}"]`);
	const sides = component.locator('.audio-comparison-side');
	if ((await sides.count()) !== 2) return;
	const dialog = await component.locator('dialog[open]').boundingBox();
	const last = await sides.last().boundingBox();
	expect(last!.y + last!.height, 'Both recordings fit in the mobile capture').toBeLessThanOrEqual(
		dialog!.y + dialog!.height
	);
}
