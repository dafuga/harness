// @harness-uid u_akqk4uwm6b
import { writeFileSync } from 'node:fs';
import { join, resolve } from 'node:path';
import {
	acknowledgeRecording,
	cachedRecording,
	finalizeRecording,
	leaseRecording,
	recordingDirectory
} from './native-video-recorder-service/nativeCache';
import { captureNativeFrames } from './native-video-recorder-service/nativeCapture';
import { encodeNativeRecording } from './native-video-recorder-service/nativeEncode';
import { recordingFailure, recordingViewport } from './native-video-recorder-service/nativeFiles';
import type {
	NativeRecording,
	NativeRecordingOptions,
	NativeRecordingReceipt
} from './NativeVideoRecorderService.types';

/** Native acquisition is independent of the 30 fps presentation export. */
export class NativeVideoRecorderService {
	constructor(private readonly root: string = resolve('.cache/harness/native-video')) {}

	run(): string {
		return 'native-video-recorder';
	}

	/** Call during warm selection, before constructing contexts or script fixtures. */
	async lookup(slotKey: string, inputHash: string): Promise<NativeRecording | undefined> {
		const cached = cachedRecording(recordingDirectory(this.root, slotKey, inputHash));
		if (cached && (cached.metadata.slotKey !== slotKey || cached.metadata.inputHash !== inputHash))
			recordingFailure('native recording cache identity does not match its slot');
		return cached;
	}

	async record(options: NativeRecordingOptions): Promise<NativeRecording> {
		recordingViewport(options.viewport);
		if (
			!options.testedRevision.trim() ||
			(options.addressedFlags ?? []).some((id) => !id.trim() || id.length > 200) ||
			(options.addressedFlags?.length ?? 0) > 256
		)
			recordingFailure('invalid native recording provenance or addressed flags');
		const cached = await this.lookup(options.slotKey, options.inputHash);
		if (cached) return cached;
		const lease = leaseRecording(this.root, options.slotKey, options.inputHash),
			started = performance.now();
		try {
			const capture = await captureNativeFrames(options, lease.directory);
			const result = encodeNativeRecording(options, capture, lease.directory);
			result.metadata.elapsedMs = performance.now() - started;
			result.metadata.runnerRssBytes = process.memoryUsage().rss;
			return finalizeRecording(lease, result);
		} catch (error) {
			writeFileSync(
				join(lease.directory, 'failure.json'),
				JSON.stringify({
					at: new Date().toISOString(),
					message: error instanceof Error ? error.message : String(error)
				})
			);
			throw error;
		} finally {
			lease.release();
		}
	}

	/** Canonical media remains; only this finalized attempt's raw JPEGs are removed. */
	async acknowledge(result: NativeRecording, receipt: NativeRecordingReceipt): Promise<void> {
		const expected = recordingDirectory(
			this.root,
			result.metadata.slotKey,
			result.metadata.inputHash
		);
		if (resolve(result.directory) !== resolve(expected))
			recordingFailure('receipt targets another recording owner');
		acknowledgeRecording(result, receipt);
	}
}
