import { expect, test } from 'vitest';
import { render } from 'svelte/server';
import VideoEvidence from '../../../src/components/verification-evidence/VideoEvidence.svelte';
import { videoItem, frameFlags } from './videoEvidenceFixture';

test('VideoEvidence.svelte is generated', () => {
	const { body } = render(VideoEvidence, {
		props: {
			item: videoItem,
			assetBase: '/harness/media/',
			initialFlags: frameFlags
		} as never
	});
	expect(body).toContain('<video');
	expect(body).toContain('controls');
	expect(body).toContain('preload="metadata"');
	expect(body).not.toContain('autoplay');
	expect(body).toContain('/harness/media/clip.mp4');
	expect(body).toContain('/harness/media/poster.png');
	for (const text of [
		'Flag current frame',
		'Frame note',
		'Active',
		'Stale',
		'Resolved',
		'Inspect this edge',
		'normal',
		'spinner',
		'loading',
		'start',
		'Original revision'
	])
		expect(body).toContain(text);
	const noReference = { ...videoItem, video: { ...videoItem.video, reference: undefined } };
	const absent = render(VideoEvidence, {
		props: { item: noReference, assetBase: '' } as never
	}).body;
	expect(absent).not.toContain('Flag current frame');
	expect(absent).toContain('No attached clip reference');
});
