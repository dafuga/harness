import { shortCommit } from '../../../../src/helpers/strings/shortCommit';
import { expect, type Locator } from '@playwright/test';
import { commits } from '../../../../test/entityUnits';

/** Exercise the viewer's own controls and retain the selected state for capture. */
export async function prepareEvidenceViewer(component: Locator, variant: string) {
	const dialog = component.getByRole('dialog');
	if (variant === 'unselected') return assertUnselected(component, dialog);
	await expect(dialog).toBeVisible();
	await selectViewerMode(dialog, variant);
	await assertViewerState(dialog, variant);
	for (const image of await dialog.locator('.viewer-images img').all()) {
		await expect
			.poll(() =>
				image.evaluate((node: HTMLImageElement) => node.complete && node.naturalWidth > 0)
			)
			.toBe(true);
		await image.evaluate((node: HTMLImageElement) => node.decode());
	}
	await assertViewerImagesFit(dialog, variant);
	await expect(dialog.getByRole('status').filter({ hasText: 'Loading image…' })).toHaveCount(0);
}

/** Unavailable navigation and displayed-side provenance are explicit, including after a switch. */
export async function assertViewerReview(component: Locator, id: string, variant: string) {
	if (id === 'reports.component.evidence-viewer' && variant === 'no-navigation') {
		const dialog = component.getByRole('dialog');
		await expect(dialog.getByRole('button', { name: 'Previous image' })).toBeDisabled();
		await expect(dialog.getByRole('button', { name: 'Next image' })).toBeDisabled();
		await expect(dialog).not.toContainText('Arrow keys to navigate');
		await component.page().keyboard.press('ArrowRight');
		await component.page().keyboard.press('ArrowLeft');
		await expect(dialog.getByRole('heading')).toHaveText('Checkout after release');
	}
	if (id === 'reports.component.evidence-viewer')
		for (const caption of await component.locator('.viewer-images figcaption').all())
			expect(await caption.innerText(), 'Caption separators have surrounding spaces').not.toMatch(
				/\S·/
			);
	if (id !== 'reports.component.harness-entity-screens' || variant !== 'viewer-open') return;
	const dialog = component.getByRole('dialog');
	await assertDisplayedRevision(dialog, commits.middle);
	await dialog.getByRole('button', { name: 'View before screenshot' }).click();
	await assertDisplayedRevision(dialog, commits.first);
	await dialog.getByRole('button', { name: 'View after screenshot' }).click();
	await assertDisplayedRevision(dialog, commits.middle);
}

async function assertDisplayedRevision(dialog: Locator, revision: string) {
	const provenance = dialog.locator('.viewer-provenance');
	await expect(
		provenance.locator('.detail-row').filter({ hasText: 'Captured from' })
	).toContainText(`build build-1 of ${shortCommit(revision)}`);
	await expect(
		provenance.locator('.detail-row').filter({ hasText: 'Verification attempt' })
	).toContainText(`targeting ${shortCommit(revision)}`);
	await expect(dialog.locator('.viewer-images figcaption')).toContainText('default · desktop');
	await expect(dialog.locator('.viewer-note')).toContainText(`revision ${revision}`);
}

/** Empty navigation uses the same visible disabled treatment as other unavailable controls. */
export async function assertViewerNavigationAppearance(
	component: Locator,
	id: string,
	variant: string
) {
	if (id !== 'reports.component.evidence-viewer' || variant !== 'no-navigation') return;
	const opacity = await component.evaluate((node) =>
		String(Number(getComputedStyle(node).getPropertyValue('--hx-opacity-disabled')))
	);
	for (const name of ['Previous image', 'Next image'])
		await expect(
			component.getByRole('button', { name }),
			'Unavailable navigation uses the disabled treatment'
		).toHaveCSS('opacity', opacity);
}

/** Preserve close interaction coverage after capturing the default open viewer. */
export async function assertEvidenceViewerCloses(component: Locator) {
	const dialog = component.getByRole('dialog');
	await dialog.getByRole('button', { name: 'Close viewer' }).click();
	await assertUnselected(component, dialog);
}

async function assertUnselected(component: Locator, dialog: Locator) {
	await expect(dialog).toHaveCount(0);
	await expect(component.getByText('No screenshot selected.', { exact: true })).toBeVisible();
}

/** Capture every image, its zoom controls, original link and caption inside the lightbox. */
async function assertViewerImagesFit(dialog: Locator, variant: string) {
	if (variant === 'missing-after') {
		await expect(dialog).toContainText('No after screenshot is recorded for this state.');
		await expect(dialog.locator('.viewer-images img')).toHaveCount(0);
		return;
	}
	const figures = dialog.locator('.viewer-images figure');
	await expect(figures).toHaveCount(variant === 'compare' ? 2 : 1);
	for (const figure of await figures.all()) {
		await expect(figure.locator('figcaption')).toBeInViewport({ ratio: 1 });
		if (await figure.locator('.zoom').count()) {
			await expect(figure.locator('.zoom')).toBeInViewport({ ratio: 1 });
			await expect(figure.locator('a')).toBeInViewport({ ratio: 1 });
		}
	}
}

async function assertViewerState(dialog: Locator, variant: string) {
	await assertViewerMetadata(dialog, variant);
	await assertViewerSelection(dialog, variant);

	if (variant === 'compare') await expect(dialog.locator('.viewer-images figure')).toHaveCount(2);

	if (variant === 'zoomed')
		await expect(dialog.getByRole('button', { name: 'Zoom out' })).toHaveAttribute(
			'aria-disabled',
			'false'
		);
	if (variant === 'actual-size') await expect(dialog.locator('output')).toHaveText('100%');
}

async function selectViewerMode(dialog: Locator, variant: string) {
	const actions: Record<string, string> = {
		before: 'View before screenshot',
		compare: 'Compare before and after',
		'viewport-mobile': 'View mobile screenshots',
		'viewport-tablet': 'View tablet screenshots',
		next: 'Next image',
		previous: 'Previous image',
		'actual-size': 'Actual size'
	};
	if (actions[variant]) await dialog.getByRole('button', { name: actions[variant] }).click();
	if (variant === 'zoomed') {
		await dialog.getByRole('button', { name: 'Actual size' }).click();
		await dialog.getByRole('button', { name: 'Zoom in' }).click();
		await dialog.getByRole('button', { name: 'Zoom in' }).click();
		await expect(dialog.locator('output')).toHaveText('150%');
		await dialog.locator('.stage.zoomed').evaluate((node) => node.scrollTo(0, 0));
	}
}

async function assertViewerSelection(dialog: Locator, variant: string) {
	if (variant === 'before')
		await expect(dialog.getByRole('heading', { name: 'Checkout before release' })).toBeVisible();
	if (variant === 'unavailable')
		await expect(dialog.getByText('The recorded screenshot could not be restored.')).toBeVisible();
	if (variant === 'no-pair')
		await expect(dialog.getByRole('button', { name: 'View mobile screenshots' })).toBeDisabled();
	if (variant === 'no-provenance')
		await expect(dialog.locator('.viewer-provenance')).toHaveCount(0);
	if (['viewport-mobile', 'next'].includes(variant))
		await expect(dialog.getByRole('heading', { name: 'Checkout on mobile' })).toBeVisible();
	if (['viewport-tablet', 'previous'].includes(variant))
		await expect(dialog.getByRole('heading', { name: 'Checkout on tablet' })).toBeVisible();
	if (variant === 'no-navigation')
		await expect(dialog.getByRole('heading', { name: 'Checkout after release' })).toBeVisible();
}

async function assertViewerMetadata(dialog: Locator, variant: string) {
	if (!['', 'before', 'compare'].includes(variant)) return;
	if (variant === 'compare') {
		for (const side of ['Before', 'After']) {
			const own = side === 'Before' ? 'checkout-parent' : 'checkout-selected';
			const other = side === 'Before' ? 'checkout-selected' : 'checkout-parent';
			const metadata = dialog
				.locator('.viewer-images figure')
				.filter({ hasText: side + ' ·' })
				.locator('.viewer-provenance');
			await expect(metadata).toContainText(own);
			await expect(metadata).not.toContainText(other);
		}
	} else {
		const metadata = dialog.locator('.viewer-provenance');
		await expect(metadata).toContainText(
			variant === 'before' ? 'checkout-parent' : 'checkout-selected'
		);
		await expect(metadata).not.toContainText(
			variant === 'before' ? 'checkout-selected' : 'checkout-parent'
		);
	}
}
