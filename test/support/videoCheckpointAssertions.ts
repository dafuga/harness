import { expect } from 'vitest';
import { videoClipSchema } from '../../src/utils/verification-evidence/videoClipSchema';
import type { VideoDeclaration } from '../../src/utils/verification-evidence/videoClipSchema.types';

export function assertVideoCheckpoints(declaration: VideoDeclaration, run: string) {
	expect(run).toBe('video-evidence');
	const manifest = videoClipSchema(declaration);
	const configured = {
		...manifest,
		discoveryGaps: [{ unit: 'page.reports', reason: 'Pilot covers only its declared graph.' }],
		clips: manifest.clips.map((clip) => ({
			...clip,
			checkpoints: [
				{ viewport: 'desktop', entrySignature: 'a'.repeat(64), exitSignature: 'b'.repeat(64) }
			]
		}))
	};
	expect(videoClipSchema(configured).discoveryGaps).toEqual(configured.discoveryGaps);
	const clip = configured.clips[0];
	for (const checkpoints of [
		[...clip.checkpoints, ...clip.checkpoints],
		[{ ...clip.checkpoints[0], viewport: 'tablet' }]
	])
		expect(() => videoClipSchema({ ...configured, clips: [{ ...clip, checkpoints }] })).toThrow(
			/viewport/i
		);
}
