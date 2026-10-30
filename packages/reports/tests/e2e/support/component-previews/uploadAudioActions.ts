import { expect, type Locator } from '@playwright/test';
import { audioFixture } from '../../../../test/audioFixture';
import { submitAudio } from './uploadAudioRequests';

/** Select the actual mode and files before capturing each upload lifecycle state. */
export async function prepareUploadAudio(component: Locator, variant: string) {
	const detail = component.locator('details.upload-audio');
	if (!variant) return await expect(detail).not.toHaveAttribute('open', '');
	await detail.locator('summary').click();
	await expect(detail).toHaveAttribute('open', '');
	const mode = component.getByRole('combobox', { name: 'Audio upload mode' });
	if (variant === 'pre-mount') {
		await expect(mode).toBeDisabled();
		await expect(
			component.getByRole('button', { name: 'Upload audio', exact: true })
		).toBeDisabled();
		await expect(component.locator('.report-select svg')).toHaveCSS('width', '16px');
		return;
	}
	await expect(mode).toBeEnabled();
	if (variant === 'mode-open') {
		await mode.click();
		await expect.poll(() => mode.evaluate((node) => node.matches(':open'))).toBe(true);
	}
	const paired =
		variant === 'comparison' ||
		variant.startsWith('comparison-') ||
		[
			'before-selected',
			'after-selected',
			'both-selected',
			'before-too-large',
			'after-too-large'
		].includes(variant);
	if (paired) {
		await mode.selectOption('comparison');
		await expect(mode).toHaveValue('comparison');
	}
	const fields = chosenFields(variant, paired);
	for (const field of fields)
		await chooseAudio(
			component,
			field,
			variant === `${field}-too-large` || variant === 'too-large'
		);
	if (isSubmission(variant)) await submitAudio(component, variant, paired);
}

function chosenFields(variant: string, paired: boolean) {
	if (['open', 'mode-open', 'comparison'].includes(variant)) return [];
	if (!paired) return ['audio'];
	if (variant === 'before-selected') return ['before'];
	if (variant === 'after-selected') return ['after'];
	return ['before', 'after'];
}

function isSubmission(variant: string) {
	return /(?:uploading|success|error|too-large|malformed-response)$/.test(variant);
}

async function chooseAudio(component: Locator, field: string, large: boolean) {
	const name = field === 'audio' ? 'review-narration.wav' : `${field}-narration.wav`;
	const input = component.locator(`input[name="${field}"]`);
	if (large) {
		await input.evaluate((node: HTMLInputElement, fileName) => {
			const selected = new DataTransfer();
			selected.items.add(new File([new Uint8Array(50_000_001)], fileName, { type: 'audio/wav' }));
			node.files = selected.files;
			node.dispatchEvent(new Event('change', { bubbles: true }));
		}, name);
	} else await input.setInputFiles({ name, mimeType: 'audio/wav', buffer: audioFixture(3) });
	await expect(component.getByText(name, { exact: true })).toBeVisible();
}
