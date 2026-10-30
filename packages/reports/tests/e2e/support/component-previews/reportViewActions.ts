import { expect, type Locator } from '@playwright/test';
import { previewCaptureBounds } from './previewCaptureBounds';

/** Prepare report-level disclosures, dialogs and gallery controls for their own captures. */
export async function prepareReportView(component: Locator, variant: string) {
	await expect(
		component.getByRole('heading', { name: 'Checkout release verification' })
	).toBeVisible();
	if (variant.endsWith('run-open') || variant === 'run-open' || variant === 'portable-open') {
		const details = component.locator('details.run-details');
		await details.locator('summary').click();
		await expect(details).toHaveAttribute('open', '');
	}
	if (['checks-open', 'acceptance-open', 'coverage-open'].includes(variant))
		await openDetail(component, variant);
	if (variant === 'image-open') {
		await component
			.getByRole('button', { name: 'Open Checkout confirmation', exact: true })
			.click();
		const dialog = component.getByRole('dialog');
		await expect(dialog).toBeVisible();
		const image = dialog.locator('img').first();
		await expect
			.poll(() =>
				image.evaluate((node: HTMLImageElement) => node.complete && node.naturalWidth > 0)
			)
			.toBe(true);
		await image.evaluate((node: HTMLImageElement) => node.decode());
	}
	if (variant === 'audio-open') {
		await component
			.getByRole('button', { name: 'Open audio comparison: Release narration' })
			.click();
		await expect(component.getByRole('dialog')).toBeVisible();
	}
	if (variant === 'audio-selected') {
		const button = component
			.getByRole('group', { name: 'Media type' })
			.getByRole('button', { name: /^Audio/ });
		await button.click();
		await expect(button).toHaveAttribute('aria-pressed', 'true');
	}
	if (variant === 'search-empty') {
		await component
			.getByRole('textbox', { name: 'Search screenshots, audio and transcripts' })
			.fill('no-match');
		await expect(component.getByText('No matching evidence.')).toBeVisible();
	}
	if (variant.startsWith('upload-')) await openUpload(component, variant);
	if (variant === 'empty') {
		await expect(component.getByText('No findings recorded.')).toBeVisible();
		await expect(component.getByText('No matching evidence.')).toBeVisible();
		await expect(component.locator('.report-intro .badge').first()).toContainText('Not proven');
		await expect(component.getByRole('link', { name: 'Download PDF' })).toHaveCount(0);
	}
	await assertDialogCapture(component, variant);
	await assertReportLifecycle(component, variant);
}

async function assertDialogCapture(component: Locator, variant: string) {
	if (!(await component.getByRole('dialog').count())) return;
	const page = component.page();
	const bounds = await previewCaptureBounds(page, 'reports.component.report-view', variant);
	const viewport = page.viewportSize();
	expect(bounds.width).toBe(viewport?.width);
	expect(bounds.height).toBe(viewport?.height);
}

async function assertReportLifecycle(component: Locator, variant: string) {
	const status: Record<string, string> = {
		running: 'Running',
		failed: 'Failed',
		blocked: 'Blocked',
		skipped: 'Skipped',
		'not-proven': 'Not proven',
		interrupted: 'Interrupted'
	};
	if (status[variant])
		await expect(component.locator('.report-intro .badge').first()).toContainText(status[variant]);
	if (variant === 'active') await expect(component.locator('.upload-audio')).toBeVisible();
	if (variant.startsWith('portable'))
		await expect(component.locator('.workspace-label')).toHaveText('Portable gallery');
	if (variant === 'stale')
		await expect(component.getByText(/No updates for over 15 minutes/)).toBeVisible();
	if (variant === 'finalizing')
		await expect(component.getByText(/Exports are being built/)).toBeVisible();
	if (variant === 'historical')
		await expect(
			component.getByText(
				'Imported evidence from an earlier run. These checks have not been rerun.'
			)
		).toBeVisible();
	if (variant === 'gaps') await expect(component.locator('.gap-count')).toContainText('2 gaps');
	if (variant === 'no-revision')
		await expect(component.locator('.run-details summary .badge')).toContainText('Not proven');
	if (variant === 'suite') await expect(component.locator('.eyebrow')).toContainText('Full suite');
}

async function openDetail(component: Locator, variant: string) {
	const labels: Record<string, string> = {
		'checks-open': 'Verification, 2 checks',
		'acceptance-open': 'Acceptance criteria, 2 criteria',
		'coverage-open': 'Workflow coverage, 2 workflows'
	};
	await component.getByRole('button', { name: labels[variant] }).click();
	await expect(component.getByRole('dialog')).toBeVisible();
}

async function openUpload(component: Locator, variant: string) {
	const detail = component.locator(
		variant === 'upload-audio-open' ? '.upload-audio' : '.upload-comparison:not(.upload-audio)'
	);
	await detail.locator('summary').click();
	await expect(detail).toHaveAttribute('open', '');
}
