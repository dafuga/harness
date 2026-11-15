// @harness-uid u_akqk4uwm6b
import { writeFileSync } from 'node:fs';
import { join } from 'node:path';
import type {
	NativeAcquisitionFrame,
	NativeFrameWriter,
	NativeRecordingOptions
} from '../NativeVideoRecorderService.types';
import { recordingFailure } from './nativeFiles';

export function nativeFrameWriter(
	directory: string,
	viewport: NativeRecordingOptions['viewport']
): NativeFrameWriter {
	const frames: NativeAcquisitionFrame[] = [];
	let bytes = 0,
		failure = '';
	return {
		frames,
		append(frame: {
			data: Buffer;
			timestamp: number;
			viewportWidth: number;
			viewportHeight: number;
		}) {
			if (failure) return;
			try {
				validateNativeFrame(frame, frames.at(-1), { frameCount: frames.length, bytes }, viewport);
				const file = `raw/${String(frames.length).padStart(6, '0')}.jpg`;
				writeFileSync(join(directory, file), frame.data);
				frames.push({ file, timestamp: frame.timestamp, bytes: frame.data.length });
				bytes += frame.data.length;
			} catch (error) {
				failure = error instanceof Error ? error.message : 'native frame write failed';
			}
		},
		check() {
			if (failure) recordingFailure(failure);
		}
	};
}

function validateNativeFrame(
	frame: Parameters<NativeFrameWriter['append']>[0],
	previous: NativeAcquisitionFrame | undefined,
	budget: { frameCount: number; bytes: number },
	viewport: NativeRecordingOptions['viewport']
): void {
	if (!Number.isFinite(frame.timestamp) || frame.timestamp <= (previous?.timestamp ?? 0))
		recordingFailure('native frame timestamps must increase');
	if (frame.viewportWidth !== viewport.width || frame.viewportHeight !== viewport.height)
		recordingFailure('native frame viewport changed during recording');
	if (
		budget.frameCount >= 2048 ||
		frame.data.length > 2 * 1024 ** 2 ||
		budget.bytes + frame.data.length > 96 * 1024 ** 2
	)
		recordingFailure('native raw frame or byte cap exceeded');
}
