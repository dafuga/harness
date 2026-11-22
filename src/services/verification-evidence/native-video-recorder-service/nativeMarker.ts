// @harness-uid u_akqk4uwm6b
import type { Page } from '@playwright/test';
import { recordingChild, recordingFailure } from './nativeFiles';
import type {
	NativeAcquisitionFrame,
	NativeRecordingMetadata
} from '../NativeVideoRecorderService.types';

export async function showRecordingMarker(page: Page): Promise<number> {
	return page.evaluate(async () => {
		const marker = globalThis.document.createElement('div');
		marker.id = '__harness_native_video_sync__';
		marker.setAttribute('popover', 'manual');
		marker.setAttribute(
			'style',
			'all:initial!important;position:fixed!important;inset:auto!important;margin:0!important;border:0!important;padding:0!important;top:0!important;left:0!important;width:48px!important;height:48px!important;background:#ff00ff!important;z-index:2147483647!important;pointer-events:none!important;opacity:1!important;'
		);
		globalThis.document.documentElement.append(marker);
		marker.showPopover();
		await new Promise<void>((resolve) =>
			globalThis.requestAnimationFrame(() => globalThis.requestAnimationFrame(() => resolve()))
		);
		return performance.timeOrigin + performance.now();
	});
}
export async function removeRecordingMarker(page: Page): Promise<number> {
	return page.evaluate(async () => {
		globalThis.document.getElementById('__harness_native_video_sync__')?.remove();
		const removed = performance.timeOrigin + performance.now();
		await new Promise<void>((resolve) =>
			globalThis.requestAnimationFrame(() => globalThis.requestAnimationFrame(() => resolve()))
		);
		return removed;
	});
}
export function verifyRecordingMarker(
	directory: string,
	frame: NativeAcquisitionFrame,
	marker: NativeRecordingMetadata['marker']
): void {
	const pixel = recordingChild(
		'ffmpeg',
		[
			'-v',
			'error',
			'-threads',
			'1',
			'-i',
			frame.file,
			'-vf',
			'format=rgb24,crop=1:1:8:8',
			'-frames:v',
			'1',
			'-f',
			'rawvideo',
			'-pix_fmt',
			'rgb24',
			'pipe:1'
		],
		directory
	);
	if (pixel.length !== 3 || pixel[0] < 180 || pixel[1] > 80 || pixel[2] < 180)
		recordingFailure('native synchronization marker is absent from the acquired frame');
	if (frame.timestamp < marker.shownTimestamp - 100 || frame.timestamp > marker.removedTimestamp)
		recordingFailure(
			'native frame timestamp does not align with the renderer synchronization marker'
		);
}
