import { expect, type Locator } from '@playwright/test';
import { assertPreviewAudio } from './audioPreviewReadiness';
import { assertEvidenceViewerCloses } from './evidenceViewerActions';

/** Assert the visible diagnostic or media state after its canonical capture is retained. */
export async function assertMediaPreviewState(component: Locator, id: string, variant: string) {
	await assertPreviewAudio(component, id, variant);
	if (id === 'reports.component.browser-errors') await assertBrowserDiagnostics(component, variant);
	if (id === 'reports.component.image-zoom') await assertImageStatus(component, variant);
	if (id === 'reports.component.audio-comparison' && variant === 'pre-mount')
		expect(
			Number(
				await component
					.locator('.audio-comparison-preview')
					.evaluate((node) => getComputedStyle(node).opacity)
			),
			'Disabled comparison has a visible disabled treatment'
		).toBeLessThan(1);
	if (id === 'reports.component.evidence-viewer' && !variant)
		await assertEvidenceViewerCloses(component);
}

async function assertBrowserDiagnostics(component: Locator, variant: string) {
	if (['empty', 'unavailable'].includes(variant)) return;
	const counts: Record<string, number> = { 'zero-entries': 0, multiple: 2 };
	const count = counts[variant] ?? 1;
	await expect(
		component.locator('summary'),
		'Diagnostic summary uses the correct entry count'
	).toHaveText(`Browser errors · ${count} ${count === 1 ? 'entry' : 'entries'}`);
	if (variant === 'zero-entries')
		await expect(
			component.getByText('No diagnostic entries were recorded for this test.', { exact: true })
		).toBeVisible();
}

async function assertImageStatus(component: Locator, variant: string) {
	if (variant === 'loading')
		await expect(component.getByRole('status'), 'Image loading is visibly announced').toHaveText(
			'Loading image…'
		);
	if (variant === 'error')
		await expect(component.getByRole('alert'), 'Image failure is visibly explained').toHaveText(
			'Image could not be loaded.'
		);
}
