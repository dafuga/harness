// @harness-uid u_3exag5gqwq
import { join } from 'node:path';
import { canonicalJson } from '../../../../../utils/development-tooling/canonicalJson';
import { captureSchema } from '../../../../../core/verification-evidence/verificationTypes';
import { videoBatchPointerSchema } from '../../../../../utils/verification-evidence/videoClipSchema';
import type { CaptureLine } from '../../../../../core/verification-evidence/verifyTypes';
import type { GatherVideoSidecar } from './gatherVideoReferences.types';
import { digestFile } from './captureLimits';

export function videoSidecar(directory: string): GatherVideoSidecar {
	const contents = digestFile(join(directory, 'video-batches.json'), 1024 * 1024, true).contents;
	const value = JSON.parse(contents!.toString('utf8')) as GatherVideoSidecar;
	if (
		value.schemaVersion !== 1 ||
		!Array.isArray(value.batches) ||
		!Array.isArray(value.captures) ||
		value.batches.length > 64 ||
		value.captures.length > 4096
	)
		throw new Error('Video sidecar exceeds its fixed metadata bounds.');
	value.batches = value.batches.map((pointer) => videoBatchPointerSchema.parse(pointer));
	value.captures = value.captures.map((row) => ({
		file: row.file,
		capture: captureSchema.parse(row.capture)
	}));
	if (new Set(value.captures.map((row) => row.file)).size !== value.captures.length)
		throw new Error('Video sidecar repeats a capture file.');
	return value;
}

export function sidecarCapture(sidecar: GatherVideoSidecar, line: CaptureLine, recordPath: string) {
	const capture = sidecar.captures.find((row) => row.file === line.file)?.capture;
	if (capture?.status !== 'passed')
		throw new Error('Video reference has no matching full capture sidecar.');
	const { path, capturedAt, status, sha256, bytes, ...wire } = capture;
	void capturedAt;
	void status;
	void sha256;
	void bytes;
	if (canonicalJson({ ...wire, file: line.file }) !== canonicalJson(line))
		throw new Error('Video capture line differs from its full descriptor.');
	if (freshPathMismatch(capture, line.file))
		throw new Error('Fresh video descriptor must name its own capture basename.');
	return { ...capture, path: capture.videoReference?.record ? path : `${recordPath}/${path}` };
}
function freshPathMismatch(
	capture: GatherVideoSidecar['captures'][number]['capture'],
	file: string
): boolean {
	return !capture.videoReference?.record && capture.path !== file;
}
