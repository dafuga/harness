import { expect, type Locator } from '@playwright/test';

const audioPreviews = new Set([
	'reports.component.evidence-card',
	'reports.component.audio-comparison-viewer',
	'reports.component.audio-evidence',
	'reports.component.evidence-grid'
]);

/** Load real fixture metadata without starting playback or changing the product's preload policy. */
export async function settlePreviewAudio(component: Locator, id: string, variant: string) {
	if (!audioPreviews.has(id) || variant === 'audio-error') return;
	const players = await component.locator('audio').all();
	for (const player of players) {
		await player.evaluate((audio: HTMLAudioElement) => {
			if (audio.readyState >= HTMLMediaElement.HAVE_METADATA) return;
			audio.preload = 'metadata';
			audio.load();
		});
		await expect.poll(() => player.evaluate((audio: HTMLAudioElement) => audio.duration)).toBe(42);
	}
	if (players.length)
		await component
			.page()
			.evaluate(
				() =>
					new Promise<void>((resolve) =>
						requestAnimationFrame(() => requestAnimationFrame(() => resolve()))
					)
			);
}

/** Every available native player must agree with the fixture's actual 42-second recording. */
export async function assertPreviewAudio(component: Locator, id: string, variant: string) {
	if (!audioPreviews.has(id) || variant === 'audio-error') return;
	for (const player of await component.locator('audio').all())
		expect(
			await player.evaluate((audio: HTMLAudioElement) => audio.duration),
			'Native player retains the loaded recording duration'
		).toBe(42);
}
