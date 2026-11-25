import { prepareShellCatalog } from './shellCatalogActions';
import { preparePresentationState } from './presentationPreviewAssertions';
import { expect, type Locator } from '@playwright/test';
import { prepareConsoleChatState } from './consoleChatActions';
import { assertProviderPickerCardState } from './providerPickerCardActions';
import { prepareProviderPickerState } from './providerPickerActions';

import { prepareAudioEvidence } from './audioEvidenceActions';

import { prepareEntitySearchState } from './entitySearchPreviewActions';

import { prepareEvidenceCard } from './evidenceCardActions';
import { prepareReportState } from './reportStateActions';
import { prepareDesktopState } from './desktopStateActions';
import { prepareDesktopGameState } from './desktopGameStateActions';

import type { CatalogPreparation, CatalogStateAction } from './catalogStateActions.types';

const actions: Record<string, CatalogStateAction> = {
	'desktop.component.game-live-ai:': async (component) => {
		await component.getByRole('button', { name: 'Live AI video…' }).click();
		const dialog = component.getByRole('dialog', { name: 'Live AI video' });
		await expect(dialog.getByRole('combobox', { name: 'AI video model' })).toHaveValue('standard');
		await expect(dialog.getByRole('button', { name: 'Start AI video' })).toBeEnabled();
	},
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

	'reports.component.regression-proof:output-open': async (component) => {
		await component.locator('summary').click();
		await expect(
			component.getByText('bunx playwright test tests/checkout.spec.ts --grep "declined payment"', {
				exact: true
			})
		).toBeVisible();
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
	}
};

/** Reproduce catalog variants that are reached through the component's own controls. */
export async function prepareCatalogState(component: Locator, id: string, variant: string) {
	if (await prepareShellCatalog(component, id, variant)) return;
	await prepareDesktopState(component, id, variant);
	await prepareDesktopGameState(component, id, variant);
	await preparePresentationState(component, id, variant);
	if (await prepareReportState(component, id, variant)) return;
	await prepareReportsCatalog(component, id, variant);
}

const requiresVariant: Partial<Record<string, CatalogPreparation>> = {
	'reports.component.entity-search': prepareEntitySearchState,
	'reports.component.console-chat': prepareConsoleChatState,
	'reports.component.provider-picker-cards': assertProviderPickerCardState
};

const catalogPreparations: Partial<Record<string, CatalogPreparation>> = {
	'reports.component.provider-picker': prepareProviderPickerState,
	'reports.component.audio-evidence': prepareAudioEvidence,
	'reports.component.evidence-card': prepareEvidenceCard
};

async function prepareReportsCatalog(component: Locator, id: string, variant: string) {
	const preparation = catalogPreparations[id] ?? (variant ? requiresVariant[id] : undefined);
	if (preparation) return preparation(component, variant);
	if (id === 'reports.component.audio-comparison') await assertAudioComparison(component, variant);
	const action = actions[`${id}:${variant}`];
	if (action) await action(component);
	if (id === 'reports.component.audio-comparison-viewer')
		await assertAudioComparisonViewer(component, variant);
}

function unavailableCount(variant: string) {
	if (variant === 'both-unavailable') return 2;
	return variant.includes('unavailable') ? 1 : 0;
}

async function assertAudioComparison(component: Locator, variant: string) {
	const opener = component.locator('.audio-comparison-preview');
	if (variant === 'pre-mount') await expect(opener).toBeDisabled();
	else await expect(opener).toBeEnabled();
	const rows = component.locator('.audio-comparison-row');
	await expect(rows).toHaveCount(2);
	const missing = unavailableCount(variant);
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
	const missing = unavailableCount(variant);
	await expect(component.locator('.audio-card.unavailable')).toHaveCount(missing);
	if (variant === 'mixed') {
		await expect(sides.nth(0).locator('.badge')).toHaveClass(/failed/);
		await expect(sides.nth(1).locator('.badge')).toHaveClass(/passed/);
	}
	if (['running', 'failed', 'blocked', 'skipped', 'not-proven', 'interrupted'].includes(variant))
		await expect(sides.nth(1).locator('.badge')).toHaveClass(new RegExp(variant));
}
