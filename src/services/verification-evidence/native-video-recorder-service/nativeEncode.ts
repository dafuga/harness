// @harness-uid u_akqk4uwm6b
import { writeFileSync } from 'node:fs';
import { join } from 'node:path';
import { mediaFacts } from '../../../utils/verification-evidence/mediaFacts';
import { recordingTimeline } from './nativeTimeline';
import { recordingChild, recordingFailure, recordingFile, recordingHash } from './nativeFiles';
import type {
	NativeCapture,
	NativeRecording,
	NativeRecordingOptions
} from '../NativeVideoRecorderService.types';

export function encodeNativeRecording(
	options: NativeRecordingOptions,
	capture: NativeCapture,
	directory: string
): NativeRecording {
	const metadata = recordingTimeline(options, capture);
	const samples = metadata.mapping
		.map(
			(sample) =>
				`file '${capture.frames[sample.sourceFrame].file}'\noption framerate 30\nduration 0.03333333333333333`
		)
		.join('\n');
	writeFileSync(join(directory, 'samples.ffconcat'), `ffconcat version 1.0\n${samples}\n`);
	recordingChild('ffmpeg', videoEncoderArguments(metadata.mapping.length), directory);
	const video = inspectRecordingMedia(directory, 'clip.mp4', 'video/mp4');
	const facts = mediaFacts(recordingFile(video.path, 8 * 1024 ** 2), 'video/mp4');
	if (
		'error' in facts ||
		facts.kind !== 'video' ||
		facts.frameCount !== metadata.mapping.length ||
		facts.frameRate !== 30 ||
		facts.width !== options.viewport.width ||
		facts.height !== options.viewport.height
	)
		recordingFailure('canonical native recording does not match its frame mapping or viewport');
	metadata.facts = facts;
	recordingChild(
		'ffmpeg',
		[
			...['-v', 'error', '-xerror', '-threads', '1', '-i', 'clip.mp4'],
			...['-vf', `select=eq(n\\,${metadata.posterFrame})`, '-frames:v', '1'],
			...['-threads', '1', '-filter_threads', '1', 'poster.png']
		],
		directory
	);
	const poster = inspectRecordingMedia(directory, 'poster.png', 'image/png');
	return { directory, metadata, video, poster };
}
function inspectRecordingMedia(directory: string, file: string, mediaType: string) {
	const path = join(directory, file),
		bytes = recordingFile(path, 8 * 1024 ** 2);
	const facts = mediaFacts(bytes, mediaType);
	if ('error' in facts)
		recordingFailure(`native recording output failed admission: ${facts.error}`);
	return { path, file, sha256: recordingHash(bytes), bytes: bytes.length };
}

function videoEncoderArguments(frameCount: number): string[] {
	return [
		...['-v', 'error', '-xerror', '-max_alloc', '67108864', '-threads', '1'],
		...['-f', 'concat', '-safe', '0', '-i', 'samples.ffconcat', '-map', '0:v:0'],
		...['-an', '-frames:v', String(frameCount), '-r', '30', '-c:v', 'libx264'],
		...['-preset', 'veryfast', '-crf', '16', '-maxrate', '3500k', '-bufsize', '3500k'],
		...[
			'-threads',
			'1',
			'-filter_threads',
			'1',
			'-vf',
			'scale=in_range=pc:out_range=tv,format=yuv420p'
		],
		...['-color_range', 'tv', '-pix_fmt', 'yuv420p', '-movflags', '+faststart', 'clip.mp4']
	];
}
