import { expect, test, vi } from 'vitest';
import { loadVideoFlags } from '../../../src/components/verification-evidence/video-evidence/videoFeedback';
import { render } from 'svelte/server';
import VideoEvidence from '../../../src/components/verification-evidence/VideoEvidence.svelte';
import { videoItem, frameFlags } from './videoEvidenceFixture';

test('VideoEvidence.svelte is generated', async () => {
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
	expect(body).toContain('Clip SHA-256');
	expect(body).toContain('Input hash');
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
	try {
		vi.stubGlobal(
			'fetch',
			async () => new Response('null', { headers: { 'Content-Type': 'application/json' } })
		);
		await expect(loadVideoFlags(videoItem.video, new AbortController().signal)).rejects.toThrow(
			'Frame feedback returned a non-object response.'
		);
	} finally {
		vi.unstubAllGlobals();
	}
});
