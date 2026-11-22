// @harness-uid u_2eznkaf4qv
import { join } from 'node:path';
import { ExpectedCliError } from '../../../core/development-tooling/errors';
import { captureDigest, captureFile, captureText } from './captureFiles';
import { observedVideo, validateVisits } from './captureVisits';
import type { NativeRecording } from '../NativeVideoRecorderService.types';
import type { VideoCaptureInput, VideoCaptureScriptInput } from '../VideoCaptureService.types';
import type { CaptureConversionContext, ConvertedCapture } from './captureConversion.types';
import type { VideoArchiveInput } from '../VideoArchiveService.types';
import type { Capture } from '../../../core/verification-evidence/verificationTypes';

export function convertedCapture(
	input: VideoCaptureInput,
	target: VideoCaptureScriptInput,
	native: NativeRecording,
	context: CaptureConversionContext
): ConvertedCapture {
	const { clip, slot } = target,
		{ metadata } = native;
	const stem = captureDigest(JSON.stringify([slot.unit, slot.clipId, slot.viewport]));
	if (metadata.facts.frameRate !== 30)
		throw new ExpectedCliError('New canonical video must use 30 fps presentation cadence.');
	const video = observedVideo(target, native, context.signatures, stem);
	validateVisits(target, video, metadata.facts.durationSeconds);
	const capture: Capture = {
		evidence: input.evidence,
		kind: 'video',
		state: clip.state,
		viewport: slot.viewport,
		status: 'passed',
		path: `${stem}.mp4`,
		sha256: native.video.sha256,
		bytes: native.video.bytes,
		mediaType: 'video/mp4',
		capturedAt: metadata.capturedAt,
		durationSeconds: metadata.facts.durationSeconds,
		provenance: 'actual-capture',
		server: { revision: input.source.commit, buildId: input.buildId },
		video
	};
	return {
		capture,
		archive: archivedCapture(input, capture, native),
		raw: {
			cacheRoot: context.cacheRoot,
			slotKey: metadata.slotKey,
			inputHash: slot.inputHash,
			addressedFlags: metadata.addressedFlags,
			directory: native.directory,
			videoSha256: native.video.sha256,
			posterSha256: native.poster.sha256,
			capture
		}
	};
}

function archivedCapture(
	input: VideoCaptureInput,
	capture: Capture,
	native: NativeRecording
): VideoArchiveInput {
	const video = capture.video!;
	const owner = JSON.parse(
		captureText(join(input.snapshot, `specification/units/${video.unit}.json`), 1024 * 1024)
	);
	return {
		slot: {
			unit: video.unit,
			unitUid: owner.uid,
			clipId: video.clipId,
			state: capture.state,
			viewport: capture.viewport!,
			profile: 'normal'
		},
		original: {
			revision: input.source.commit,
			tree: input.source.tree,
			buildId: input.buildId,
			capturedAt: capture.capturedAt
		},
		video,
		durationSeconds: capture.durationSeconds!,
		sha256: capture.sha256,
		videoBytes: captureFile(native.video.path, native.video.sha256),
		posterBytes: captureFile(native.poster.path, native.poster.sha256)
	};
}
