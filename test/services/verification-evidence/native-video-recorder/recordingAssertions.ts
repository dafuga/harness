import { existsSync } from 'node:fs';
import type { NativeVideoRecorderService } from '../../../../src/services/verification-evidence/NativeVideoRecorderService';
import { spawnSync } from 'node:child_process';
import { join } from 'node:path';
import { expect } from 'vitest';
import type {
	NativeRecording,
	NativeRecordingOptions
} from '../../../../src/services/verification-evidence/NativeVideoRecorderService.types';

export function assertRecordingFidelity(result: NativeRecording): void {
	const pixels = decodedRgbFrames(result.video.path);
	const sourcePixels = new Map<number, Buffer>();
	for (const sample of result.metadata.mapping) {
		if (!sourcePixels.has(sample.sourceFrame))
			sourcePixels.set(
				sample.sourceFrame,
				decodedRgbFrames(
					join(result.directory, result.metadata.native.frames[sample.sourceFrame].file)
				)
			);
		const actual = pixels.subarray(sample.frameNumber * 3, sample.frameNumber * 3 + 3);
		const expected = sourcePixels.get(sample.sourceFrame)!;
		expect(
			Math.max(...actual.map((channel, index) => Math.abs(channel - expected[index])))
		).toBeLessThan(45);
	}
	expect(
		new Set(
			result.metadata.mapping.map((sample) =>
				pixels.subarray(sample.frameNumber * 3, sample.frameNumber * 3 + 3).toString('hex')
			)
		).size
	).toBeGreaterThan(3);
}

export function assertRecordingTimeline(result: NativeRecording): void {
	for (const event of result.metadata.events) {
		expect(event.atSeconds).toBeGreaterThanOrEqual(0.3);
		expect(event.frameNumber / 30 - event.atSeconds).toBeGreaterThanOrEqual(-0.001);
		expect(event.frameNumber / 30 - event.atSeconds).toBeLessThan(1 / 30 + 0.001);
	}
	expect(result.metadata.marker.nativeTimestamp).toBeLessThan(
		result.metadata.interval.startTimestamp
	);
	expect(
		result.metadata.interval.endTimestamp - result.metadata.events.at(-1)!.timestamp
	).toBeGreaterThanOrEqual(500);
}

function decodedRgbFrames(path: string): Buffer {
	const child = spawnSync(
		'ffmpeg',
		[
			...['-v', 'error', '-threads', '1', '-i', path, '-vf', 'format=rgb24,crop=1:1:75:75'],
			...['-frames:v', '450', '-threads', '1', '-filter_threads', '1', '-fps_mode', 'passthrough'],
			...['-f', 'rawvideo', '-pix_fmt', 'rgb24', 'pipe:1']
		],
		{ timeout: 20_000, maxBuffer: 10_000 }
	);
	expect(child.status, child.stderr?.toString()).toBe(0);
	return child.stdout;
}

export async function assertRecordingCache(
	service: NativeVideoRecorderService,
	result: NativeRecording,
	options: NativeRecordingOptions
): Promise<void> {
	const cached = await service.lookup('success', 'a'.repeat(64), result.metadata.addressedFlags);
	expect(cached?.metadata).toEqual(result.metadata);
	const again = await service.record({
		...options,
		addressedFlags: result.metadata.addressedFlags,
		prepare: async () => {
			throw new Error('must not open cache');
		}
	});
	expect(again.metadata.capturedAt).toBe(result.metadata.capturedAt);
	expect(options.browser.contexts()).toHaveLength(0);
	expect(existsSync(join(result.directory, 'raw'))).toBe(true);
	await expect(
		service.acknowledge(result, {
			record: 'receipt',
			videoSha256: 'wrong',
			posterSha256: result.poster.sha256
		})
	).rejects.toThrow(/receipt/);
	await service.acknowledge(result, {
		record: 'receipt',
		videoSha256: result.video.sha256,
		posterSha256: result.poster.sha256
	});
	expect(existsSync(join(result.directory, 'raw'))).toBe(false);
}

export async function assertFlagReplacement(
	service: NativeVideoRecorderService,
	options: NativeRecordingOptions,
	previous: NativeRecording
): Promise<void> {
	const replacement = await service.record({ ...options, addressedFlags: ['flag-next', 'flag-a'] });
	expect(replacement.metadata.addressedFlags).toEqual(['flag-a', 'flag-next']);
	expect(replacement.directory).not.toBe(previous.directory);
	expect(replacement.metadata.capturedAt).not.toBe(previous.metadata.capturedAt);
	const warm = await service.record({
		...options,
		addressedFlags: ['flag-a', 'flag-next', 'flag-next'],
		prepare: async () => {
			throw new Error('same flag set must reuse');
		}
	});
	expect(warm.metadata.capturedAt).toBe(replacement.metadata.capturedAt);
	const original = await service.lookup(
		options.slotKey,
		options.inputHash,
		previous.metadata.addressedFlags
	);
	expect(original?.metadata.capturedAt).toBe(previous.metadata.capturedAt);
}
