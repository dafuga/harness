import { expect, type Locator } from '@playwright/test';
import { audioFixture } from '../../../../test/audioFixture';

/** Select real audio files and verify the enabled or disabled controls shown by each example. */
export async function prepareAudioUploadFiles(component: Locator, variant: string) {
	const paired = ['comparison', 'uploading', 'before-selected', 'after-selected', 'both-selected'];
	const inputs = component.locator('input[type="file"]');
	await expect(inputs).toHaveCount(paired.includes(variant) ? 2 : 1);
	for (const input of await inputs.all()) {
		if (['uploading', 'single-uploading'].includes(variant)) await expect(input).toBeDisabled();
		else await expect(input).toBeEnabled();
	}
	const files: Record<string, Array<[string, string]>> = {
		selected: [['audio', 'review-narration.wav']],
		'before-selected': [['before', 'baseline-narration.wav']],
		'after-selected': [['after', 'release-narration.wav']],
		'both-selected': [
			['before', 'baseline-narration.wav'],
			['after', 'release-narration.wav']
		]
	};
	for (const [field, name] of files[variant] ?? []) {
		await component.locator(`input[name="${field}"]`).setInputFiles({
			name,
			mimeType: 'audio/wav',
			buffer: audioFixture(3)
		});
		await expect(component.getByText(name, { exact: true })).toBeVisible();
	}
}
