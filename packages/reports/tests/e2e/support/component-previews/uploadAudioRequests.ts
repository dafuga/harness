import { expect, type Locator } from '@playwright/test';
import { reportSummaryFixture } from './reportSummaryVariants';

/** Respond to this fixture's requests without touching report storage. */
export async function submitAudio(component: Locator, variant: string, paired: boolean) {
	const page = component.page();
	await page.route('**/api/report-audio-*', async (route) => {
		const body = route.request().postData() ?? '';
		expect(body).toContain('preview-report');
		expect(body).toContain('Checkout voice review');
		if (variant.endsWith('uploading')) {
			await new Promise<void>((resolve) => page.once('close', () => resolve()));
			return;
		}
		if (variant === 'network-error') return route.abort('failed');
		if (variant.endsWith('-error'))
			return route.fulfill({
				status: 503,
				json: { error: 'Audio upload temporarily unavailable.' }
			});
		if (variant === 'malformed-response') return route.fulfill({ status: 201, json: {} });
		return route.fulfill({ status: 201, json: reportSummaryFixture });
	});
	await component.getByRole('textbox', { name: 'Audio title' }).fill('Checkout voice review');
	await component.getByRole('textbox', { name: 'Source' }).fill('Release review microphone');
	await component
		.getByRole('textbox', { name: 'Notes' })
		.fill('Listen for the final confirmation.');
	const label = paired ? 'Upload audio comparison' : 'Upload audio';
	const submit = component.getByRole('button', { name: label, exact: true });
	await submit.click();
	const status = component.getByRole('status');
	await expect(status).toContainText(messageFor(variant, paired));
	if (variant.endsWith('uploading')) await expect(submit).toBeDisabled();
	else await expect(submit).toBeEnabled();
	if (variant.endsWith('success'))
		await expect(component.getByText('WAV, MP3, M4A or OGG · up to 50 MB')).toHaveCount(
			paired ? 2 : 1
		);
}

function messageFor(variant: string, paired: boolean) {
	if (variant.includes('too-large')) return 'Audio files must be 50 MB or smaller.';
	if (variant.endsWith('uploading'))
		return paired ? 'Uploading audio comparison…' : 'Uploading audio…';
	if (variant.endsWith('success'))
		return paired ? 'Audio comparison added to gallery' : 'Audio added to gallery';
	if (variant === 'malformed-response' || variant === 'network-error') return 'Upload failed';
	return 'Audio upload temporarily unavailable.';
}
