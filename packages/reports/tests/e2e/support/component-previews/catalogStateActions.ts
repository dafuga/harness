import { expect, type Locator } from '@playwright/test';
import { prepareConsoleChatState } from './consoleChatActions';

type CatalogStateAction = (component: Locator) => Promise<void>;

const actions: Record<string, CatalogStateAction> = {
	'reports.component.audio-comparison-viewer:before': async (component) => {
		await component.getByRole('button', { name: 'View before recording' }).click();
		await expect(component.getByRole('group', { name: 'Before recording' })).toBeVisible();
	},
	'reports.component.audio-comparison-viewer:after': async (component) => {
		await component.getByRole('button', { name: 'View after recording' }).click();
		await expect(component.getByRole('group', { name: 'After recording' })).toBeVisible();
	},
	'reports.component.audio-comparison-viewer:transcript-closed': async (component) => {
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
	'reports.component.audio-evidence:notes': async (component) => {
		await component.locator('.audio-details summary').click();
		await expect(
			component.getByText('Timing and diction were reviewed before approval.', { exact: true })
		).toBeVisible();
	},
	'reports.component.evidence-card:compact': async (component) => {
		await component.locator('summary').click();
		await expect(component.getByText('Browser capture', { exact: true })).toBeVisible();
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
	'reports.component.entity-search:open': async (component) => {
		await component.getByRole('button', { name: 'Search entities', exact: true }).click();
		const dialog = component.getByRole('dialog', { name: 'Search project' });
		await expect(dialog).toBeVisible();
		await dialog.getByRole('combobox', { name: 'Search entities' }).fill('order');
		await expect(dialog.getByRole('option').first()).toBeVisible();
	},
	'reports.component.filter-dialog:open': async (component) => {
		await component.getByRole('button', { name: 'Filters', exact: true }).click();
		await expect(component.getByRole('dialog', { name: 'Filters', exact: true })).toBeVisible();
	}
};

/** Reproduce catalog variants that are reached through the component's own controls. */
export async function prepareCatalogState(component: Locator, id: string, variant: string) {
	if (id === 'reports.component.console-chat' && variant)
		return prepareConsoleChatState(component, variant);
	if (id === 'reports.component.audio-comparison') await assertAudioComparison(component, variant);
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
	await expect(sides).toHaveCount(['before', 'after'].includes(variant) ? 1 : 2);
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
