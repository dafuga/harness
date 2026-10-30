import { expect, type Locator } from '@playwright/test';
import { reportSummaryFixture } from './reportSummaryVariants';

const pixel = Buffer.from(
	'iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR42mP8/x8AAwMCAO+nm8sAAAAASUVORK5CYII=',
	'base64'
);

/** Use the uploader's real controls and a scoped synthetic endpoint response. */
export async function prepareUploadComparison(component: Locator, variant: string) {
	const detail = component.locator('details.upload-comparison');
	const submit = component.getByRole('button', { name: 'Upload comparison' });
	if (!variant) {
		await expect(detail).not.toHaveAttribute('open', '');
		return;
	}
	await detail.locator('summary').click();
	await expect(detail).toHaveAttribute('open', '');
	if (variant === 'pre-mount') return await expect(submit).toBeDisabled();
	await expect(submit).toBeEnabled();
	const viewport = component.getByRole('combobox', { name: 'Viewport' });
	if (variant === 'viewport-open') {
		await viewport.click();
		await expect.poll(() => viewport.evaluate((node) => node.matches(':open'))).toBe(true);
	} else if (variant.startsWith('viewport-')) {
		await viewport.selectOption(variant.slice('viewport-'.length));
		await expect(viewport).toHaveValue(variant.slice('viewport-'.length));
	}
	const before = ['before-selected', 'both-selected', 'uploading', 'success', 'error'];
	const after = ['after-selected', 'both-selected', 'uploading', 'success', 'error'];
	if (before.includes(variant)) await chooseImage(component, 'before');
	if (after.includes(variant)) await chooseImage(component, 'after');
	if (['uploading', 'success', 'error'].includes(variant))
		await submitComparison(component, submit, variant);
}

async function chooseImage(component: Locator, field: 'before' | 'after') {
	const name = `checkout-${field}.png`;
	await component
		.locator(`input[name="${field}"]`)
		.setInputFiles({ name, mimeType: 'image/png', buffer: pixel });
	await expect(component.getByText(name, { exact: true })).toBeVisible();
}

async function submitComparison(component: Locator, submit: Locator, variant: string) {
	const page = component.page();
	await page.route('**/api/report-screenshot-upload', async (route) => {
		const body = route.request().postData() ?? '';
		expect(body).toContain('preview-report');
		expect(body).toContain('Checkout confirmation');
		if (variant === 'uploading') {
			await new Promise<void>((resolve) => page.once('close', () => resolve()));
			return;
		}
		if (variant === 'error')
			return route.fulfill({ status: 503, json: { error: 'Upload temporarily unavailable.' } });
		return route.fulfill({ json: reportSummaryFixture });
	});
	await component.getByRole('textbox', { name: 'Comparison title' }).fill('Checkout confirmation');
	await component.getByRole('combobox', { name: 'Viewport' }).selectOption('desktop');
	await submit.click();
	const message = {
		uploading: 'Uploading…',
		success: 'Added to gallery',
		error: 'Upload temporarily unavailable.'
	}[variant]!;
	await expect(component.getByRole('status')).toHaveText(message);
	if (variant === 'uploading') {
		await expect(submit).toBeDisabled();
		await expect(component.locator('input[name="before"]')).toBeDisabled();
	} else {
		await expect(submit).toBeEnabled();
		if (variant === 'success')
			await expect(component.getByText('Choose PNG, JPEG or WebP')).toHaveCount(2);
	}
}
