import { expect, type Locator } from '../../../../../../test/support/browserTest';
import { shellCatalogVariants } from './shellCatalogVariants';
import { commits } from '../../../../test/entityUnits';

/** Prepare state through normal controls and assert that the fixture reached its named branch. */
const actions: Record<string, (component: Locator, variant: string) => Promise<void>> = {
	'harness-entity-artifact': artifactState,
	'harness-entity-history': historyState,
	'harness-entity-audio': audioState,
	'harness-entity-screens': screensState,
	'harness-entity-sections': sectionsState,
	'harness-harness-verdict': verdictState,
	'harness-harness-navbar': navbarState,
	'harness-harness-action': actionState,
	'harness-harness-selectors': selectorsState,
	'shared-primitives-loading-state': loadingState,
	'harness-harness-icon': iconState
};
export async function prepareShellCatalog(component: Locator, id: string, variant: string) {
	if (!(id in shellCatalogVariants)) return false;
	await actions[id.replace('reports.component.', '')]?.(component, variant);
	if (id.includes('harness-explorer-')) await explorerState(component, id, variant);
	if (variant === 'focused') {
		const focus = component.locator('input, a, button').first();
		await focus.focus();
		await expect(focus).toBeFocused();
	}
	return true;
}
async function historyState(component: Locator, variant: string) {
	if (variant === 'profiles') {
		const profile = component.getByRole('combobox', { name: 'Performance profile' });
		await profile.selectOption('ci-linux');
		await expect(profile).toHaveValue('ci-linux');
		await expect(component.locator('.ex-history')).toContainText('0.31');
	}
	if (variant === 'long')
		await expect(
			component.locator('.ex-full > summary').first(),
			'Long history attaches change notes to the displayed entity'
		).toBeVisible();
	if (variant === 'reading')
		await component.getByRole('button', { name: 'Read the next commits' }).click();
	if (variant === 'empty') await expect(component).toContainText('No commit read so far');
	if (variant === 'unread') await expect(component).toContainText('not known until');
	if (variant === 'reading')
		await expect(component.getByRole('button', { name: 'Reading…', exact: true })).toBeDisabled();
}
async function audioState(component: Locator, variant: string) {
	let title = 'Current audio';
	if (variant) title = 'Audio comparison';
	if (variant === 'empty') title = 'No audio evidence';
	await expect(component).toContainText(title);
	if (variant.startsWith('missing')) await expect(component).toContainText('No clip of this state');
	if (variant === 'transcript-closed')
		for (const details of await component.locator('details').all())
			if ((await details.getAttribute('open')) !== null)
				await details.locator('summary').first().click();
}
async function screensState(component: Locator, variant: string) {
	if (variant === 'viewer-open') {
		await component.locator('.ex-shot').first().click();
		const dialog = component.getByRole('dialog');
		await expect(dialog).toBeVisible();
		await dialog.locator('.viewer-images img').evaluateAll(async (images) => {
			await Promise.all(images.map((image) => (image as HTMLImageElement).decode()));
		});
		await expect(dialog.getByRole('status').filter({ hasText: 'Loading image…' })).toHaveCount(0);
		await expect(dialog.locator('output')).toHaveText(/\d+%/);
	}
	if (variant === 'mobile-selected') {
		await component.getByRole('button', { name: 'Mobile', exact: true }).click();
		await expect(component.getByRole('button', { name: 'Mobile', exact: true })).toHaveAttribute(
			'aria-pressed',
			'true'
		);
	}
	if (variant === 'missing') await expect(component).toContainText('No capture');
	if (variant === 'incomparable') await expect(component).toContainText('Not comparable');
}
async function sectionsState(component: Locator, variant: string) {
	if (variant !== 'tests') return;
	await component.getByText('Verification details', { exact: true }).click();
	await expect(component.getByText(`Verification at ${commits.middle.slice(0, 7)}`)).toBeVisible();
	await component.locator('img').evaluateAll(async (images) => {
		await Promise.all(
			images
				.filter((image) => image.getClientRects().length)
				.map((image) => (image as HTMLImageElement).decode())
		);
	});
}
async function verdictState(component: Locator, variant: string) {
	if (variant.startsWith('badge-')) {
		await expect(component.locator('.badge')).toBeVisible();
		return;
	}
	if (variant.startsWith('run')) {
		await expect(component.getByRole('status')).toContainText('Invoice approval review');
		await expect(component.getByRole('button', { name: 'Cancel run' })).toHaveCount(
			variant === 'run' ? 1 : 0
		);
		return;
	}
	if (variant.startsWith('icon')) {
		const failed = [
			'icon-failed',
			'icon-unverified',
			'icon-unknown',
			'icon-no-reason',
			'icon-long'
		].includes(variant);
		await expect(component.getByRole('button')).toHaveText(failed ? '×' : '✓');
		if (variant !== 'icon') {
			await component.getByRole('button').focus();
			await expect(component.getByRole('status')).toBeVisible();
		}
		return;
	}

	if (variant.endsWith('-open')) {
		await component.getByRole('button').click();
		await expect(component.getByRole('tooltip')).toBeVisible();
	}
	let state = 'passed';
	if (variant.startsWith('unknown')) state = 'unknown';
	if (variant.startsWith('failed') || variant === 'long-open') state = 'failed';
	await expect(component.locator('.hx-verdict')).toHaveClass(new RegExp(state));
}
async function navbarState(component: Locator, variant: string) {
	if (variant !== 'search-open') return;
	await component.getByRole('button', { name: /Search/ }).click();
	await expect(component.getByRole('dialog')).toBeVisible();
}
async function actionState(component: Locator, variant: string) {
	if (variant === 'disabled') await expect(component.getByRole('button')).toBeDisabled();
}
async function loadingState(component: Locator, variant: string) {
	if (variant !== 'reduced-motion') return;
	await component.page().emulateMedia({ reducedMotion: 'reduce' });
	await expect(component.locator('.hx-loading-indicator')).toHaveCSS('animation-name', 'none');
}
async function iconState(component: Locator, variant: string) {
	if (variant !== 'decorative')
		await expect(component.getByRole('img', { name: 'Component', exact: true })).toBeVisible();
	await expect(component.locator('path')).toHaveAttribute('d', /\S+/);
}

async function artifactState(component: Locator, variant: string) {
	const words: Record<string, string> = {
		'not-recorded': 'Not recorded',
		'not-stored': 'Not stored',
		loading: 'Reading what it holds…',
		unverified: 'Not verified',
		lost: 'Not verified'
	};
	if (words[variant]) await expect(component).toContainText(words[variant]);
	if (['expanded', 'raw-open', 'plain-text', 'long'].includes(variant)) {
		await component.getByText('Assertions and recorded result', { exact: true }).click();
		if (variant === 'raw-open') {
			await component.getByText('Recorded JSON', { exact: true }).click();
			await expect(component.locator('details[open] details[open] pre')).toContainText('scenario');
		}
		if (variant === 'long')
			await expect(component).toContainText('shortened; open the recorded file');
		if (variant === 'plain-text')
			await expect(component).toContainText('The recorded command completed successfully.');
	}
}

async function explorerState(component: Locator, id: string, variant: string) {
	if (['search', 'no-matches'].includes(variant)) {
		await component.getByRole('searchbox').fill(variant === 'search' ? 'Order' : 'refund policy');
		if (variant === 'no-matches') await expect(component).toContainText(/No .* match this search/);
	}
	if (id.endsWith('explorer-frame') && variant === 'source-open') {
		await component.getByRole('button', { name: 'View OrderList source' }).click();
		await expect(component.getByRole('dialog')).toBeVisible();
	}
	if (variant === 'unindexed')
		await expect(component).toContainText('No registry at this revision');
	if (variant === 'empty') await expect(component).toContainText(/No .* are in the registry/);
	if (id.endsWith('explorer-controls'))
		await expect(component.getByRole('searchbox')).toBeVisible();
}

async function selectorsState(component: Locator, variant: string) {
	if (!['tip', 'at-tip'].includes(variant)) return;
	await expect(component.getByRole('combobox', { name: 'Branch', exact: true })).toHaveValue(
		'feature/orders'
	);
	await expect(component.getByRole('combobox', { name: 'Commit', exact: true })).toHaveValue(
		commits.middle
	);
	await expect(component.locator('.report-select-value')).toHaveText([
		'feature/orders',
		commits.middle.slice(0, 7)
	]);
	const tip = component.getByRole('button', { name: 'Go to tip', exact: true });
	if (variant === 'at-tip') await expect(tip).toBeDisabled();
	else await expect(component.getByRole('link', { name: 'Go to tip', exact: true })).toBeVisible();
}
