import { readFileSync } from 'node:fs';
import { FrameFlagService } from '../../src/services/verification-evidence/FrameFlagService';
import type { VideoCaptureResult } from '../../src/services/verification-evidence/VideoCaptureService.types';
import type { videoCaptureFixture } from './videoCaptureFixture';

export async function captureReviewFlag(
	f: Awaited<ReturnType<typeof videoCaptureFixture>>,
	cold: VideoCaptureResult
) {
	const capture = cold.captures[0],
		native = f.native.produced[0];
	const service = new FrameFlagService(f.root, async (reference) => ({
		...reference,
		bytes: readFileSync(native.video.path),
		sha256: capture.sha256,
		inputHash: capture.video!.inputHash,
		durationSeconds: capture.durationSeconds!,
		frameRate: capture.video!.frameRate,
		width: 160,
		height: 120,
		capturedAt: capture.capturedAt,
		addressedFlags: []
	}));
	return service.flag({
		clip: {
			revision: cold.source.commit,
			record: 'a'.repeat(64),
			unit: 'component.player',
			clipId: 'first',
			viewport: 'desktop'
		},
		frameNumber: 10,
		note: 'Read this actual frame before replacement'
	});
}
