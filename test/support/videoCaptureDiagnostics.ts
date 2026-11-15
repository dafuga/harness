import { copyFileSync, mkdirSync, writeFileSync } from 'node:fs';
import { join } from 'node:path';
import type { VideoCaptureResult } from '../../src/services/verification-evidence/VideoCaptureService.types';

/** Optional task diagnostics stay outside source and are never included in ordinary test runs. */
export function videoCaptureDiagnostics(result: VideoCaptureResult): void {
	const directory = process.env.HARNESS_VIDEO_DIAGNOSTICS;
	if (!directory) return;
	mkdirSync(directory, { recursive: true });
	for (const name of ['clip.mp4', 'poster.png', 'result.json'])
		copyFileSync(join(result.raw[0].directory, name), join(directory, name));
	writeFileSync(join(directory, 'capture.json'), JSON.stringify(result, null, 2));
}
