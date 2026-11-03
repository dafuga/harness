import { expect, type Locator } from '@playwright/test';

/** Each audio presentation shows the state its variant names, with the clips it should have. */
export async function assertRuntimeAudioPresentation(
	component: Locator,
	id: string,
	variant: string
) {
	if (id !== 'desktop.component.runtime-audio') return;
	await assertNoticeBesideGlyph(component, variant);
	const clips = component.locator('audio');
	if (variant === 'default') {
		await expect(component.getByText('Current audio', { exact: true })).toBeVisible();
		await expect(clips, 'Current audio shows one playable clip').toHaveCount(1);
		return;
	}
	if (variant === 'paired') {
		await expect(component.getByText('Audio before and after', { exact: true })).toBeVisible();
		await expect(clips, 'A commit comparison shows both clips').toHaveCount(2);
		await expect(
			component.getByText('Before', { exact: true }),
			'The earlier card is labelled Before'
		).toBeVisible();
		await expect(
			component.getByText('After', { exact: true }),
			'The later card is labelled After'
		).toBeVisible();
		return;
	}
	if (variant === 'missing-before') {
		await expect(
			component.getByText('No clip of this state is recorded for', { exact: false }),
			'A side without a clip is an explicit gap'
		).toBeVisible();
		await expect(clips, 'The recorded side keeps its clip').toHaveCount(1);
		return;
	}
	if (variant === 'declared-absent') {
		await expect(
			component.getByText('A clip is declared for this entity, and none is recorded at', {
				exact: false
			}),
			'A declared clip that is absent is an explicit gap'
		).toBeVisible();
		await expect(clips).toHaveCount(0);
		return;
	}
	if (variant === 'unverified') {
		await expect(
			component.getByText('The clip bytes do not match the recorded hash.', { exact: true }),
			'A clip that cannot be read names why it is unverified'
		).toBeVisible();
		await expect(clips).toHaveCount(0);
		await expect(component.getByText('Fresh capture', { exact: false })).toHaveCount(0);
		return;
	}
	if (variant === 'reading') {
		await expect(component.getByText('Reading the clip…', { exact: true })).toBeVisible();
		await expect(clips).toHaveCount(0);
		await expect(component.getByText('Fresh capture', { exact: false })).toHaveCount(0);
	}
}

/** A notice's status glyph sits beside its message, not at the far edge of the card. */
async function assertNoticeBesideGlyph(component: Locator, variant: string) {
	if (!['missing-before', 'declared-absent', 'unverified'].includes(variant)) return;
	const notice = component.locator('.runtime-audio-runtime-gap').first();
	const parts = notice.locator(':scope > *');
	const glyph = (await notice.locator('button').first().boundingBox())!;
	const message = (await parts.nth(1).boundingBox())!;
	expect(
		message.x - (glyph.x + glyph.width),
		'The status glyph sits right beside its message'
	).toBeLessThanOrEqual(16);
}
