// @harness-uid u_akqk4uwm6b
import { recordingFailure, recordingFlags } from './nativeFiles';
import type {
	NativeCapture,
	NativeRecordingMetadata,
	NativeRecordingOptions
} from '../NativeVideoRecorderService.types';
export function recordingTimeline(
	options: NativeRecordingOptions,
	capture: NativeCapture
): NativeRecordingMetadata {
	const { start, endTimestamp, count } = retainedRecordingInterval(capture);
	const mapping = sampleRecordingFrames(capture.frames, start.timestamp, count);
	const events = mappedRecordingEvents(capture, mapping, start.timestamp);
	if (events.some((event) => event.frameNumber >= count || event.atSeconds < 0))
		recordingFailure('asserted native event lies outside encoded frames');
	const gaps = capture.frames
		.slice(1)
		.map((frame, index) => frame.timestamp - capture.frames[index].timestamp);
	return {
		schemaVersion: 1,
		slotKey: options.slotKey,
		inputHash: options.inputHash,
		testedRevision: options.testedRevision,
		capturedAt: new Date().toISOString(),
		addressedFlags: recordingFlags(options.addressedFlags),
		viewport: options.viewport,
		recipe: 'native-jpeg-sample-previous-h264-yuv420p-30fps-v1',
		marker: capture.marker,
		interval: { startTimestamp: start.timestamp, endTimestamp },
		native: {
			frames: capture.frames,
			meanFrameRate:
				((capture.frames.length - 1) * 1000) /
				(capture.frames.at(-1)!.timestamp - capture.frames[0].timestamp),
			maxGapMs: Math.max(...gaps),
			bytes: capture.frames.reduce((sum, frame) => sum + frame.bytes, 0)
		},
		mapping,
		events,
		facts: initialRecordingFacts(options, count),
		posterFrame: events.filter((event) => event.kind === 'state').at(-1)!.frameNumber,
		elapsedMs: 0,
		runnerRssBytes: process.memoryUsage().rss
	};
}
function sampleRecordingFrames(
	frames: NativeCapture['frames'],
	startTimestamp: number,
	count: number
) {
	let sourceFrame = 0;
	return Array.from({ length: count }, (_, frameNumber) => {
		const timestamp = startTimestamp + (frameNumber * 1000) / 30;
		while (sourceFrame + 1 < frames.length && frames[sourceFrame + 1].timestamp <= timestamp)
			sourceFrame++;
		return { frameNumber, sourceFrame, nativeTimestamp: frames[sourceFrame].timestamp };
	});
}

function retainedRecordingInterval(capture: NativeCapture) {
	const trigger = capture.events[0],
		lastEvent = capture.events.at(-1)!;
	const startIndex = capture.frames.reduce(
		(found, frame, index) => (frame.timestamp <= trigger.timestamp - 300 ? index : found),
		-1
	);
	const endTimestamp = capture.finishedTimestamp;
	if (startIndex < 0 || endTimestamp < lastEvent.timestamp + 500)
		recordingFailure('native recording lacks required lead-in or final assertion tail');
	const start = capture.frames[startIndex];
	const durationSeconds = (endTimestamp - start.timestamp) / 1000;
	const count = Math.ceil(durationSeconds * 30);
	if (
		durationSeconds > 15 ||
		count > 450 ||
		count < 1 ||
		start.timestamp <= capture.marker.removedTimestamp
	)
		recordingFailure(
			'native retained interval exceeds 15 seconds or contains the synchronization marker'
		);
	return { start, endTimestamp, count };
}

function initialRecordingFacts(
	options: NativeRecordingOptions,
	count: number
): NativeRecordingMetadata['facts'] {
	return {
		kind: 'video',
		width: options.viewport.width,
		height: options.viewport.height,
		durationSeconds: count / 30,
		frameRate: 30,
		frameCount: count,
		codec: 'h264',
		pixelFormat: 'yuv420p'
	};
}

function mappedRecordingEvents(
	capture: NativeCapture,
	mapping: NativeRecordingMetadata['mapping'],
	startTimestamp: number
): NativeRecordingMetadata['events'] {
	return capture.events.map((event) => {
		const after = Math.max(event.timestamp, event.sourceTimestamp ?? event.timestamp);
		const sample = mapping.find(
			(sample) =>
				startTimestamp + (sample.frameNumber * 1000) / 30 >= after &&
				sample.nativeTimestamp >= (event.sourceTimestamp ?? -Infinity)
		);
		if (!sample) recordingFailure('No encoded frame maps to the asserted native paint.');
		return { ...event, atSeconds: sample.frameNumber / 30, frameNumber: sample.frameNumber };
	});
}
