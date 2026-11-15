// @harness-uid u_2eznkaf4qv
import {
	appendFileSync,
	constants,
	closeSync,
	fstatSync,
	openSync,
	existsSync,
	lstatSync,
	mkdirSync,
	readFileSync,
	renameSync,
	writeFileSync
} from 'node:fs';
import { join, basename } from 'node:path';
import { randomUUID } from 'node:crypto';
import { captureIndex, captureLineSchema } from '../../../core/verification-evidence/verifyTypes';
import { ExpectedCliError } from '../../../core/development-tooling/errors';
import { canonicalJson } from '../../../utils/development-tooling/canonicalJson';
import type { Capture } from '../../../core/verification-evidence/verificationTypes';
import type { VideoBatchPointer } from '../VideoArchiveService.types';
import type { VideoCaptureSidecar } from '../VideoCaptureService.types';

export const videoBatchSidecar = 'video-batches.json';
/** The parent transports descriptors only; canonical objects remain in their bounded child batch. */
export function captureProtocol(directory: string) {
	mkdirSync(directory, { recursive: true });
	const path = join(directory, videoBatchSidecar),
		index = join(directory, captureIndex);
	const sidecar: VideoCaptureSidecar = existsSync(path)
		? JSON.parse(boundedText(path, 1024 * 1024))
		: { schemaVersion: 1, batches: [], captures: [] };
	if (
		sidecar.schemaVersion !== 1 ||
		!Array.isArray(sidecar.batches) ||
		!Array.isArray(sidecar.captures)
	)
		throw new ExpectedCliError('Invalid existing video capture sidecar.');
	return {
		append(capture: Capture, batches: VideoBatchPointer[]) {
			const { path: originalPath, status, sha256, bytes, capturedAt, ...wire } = capture;
			void status;
			void sha256;
			void bytes;
			void capturedAt;
			const file = basename(originalPath);
			const line = captureLineSchema.parse({ ...wire, file });
			const old = sidecar.captures.find((row) => row.file === file);
			if (old) {
				if (canonicalJson(old.capture) !== canonicalJson(capture))
					throw new ExpectedCliError(
						'Video capture sidecar path already names different evidence.'
					);
				return;
			}
			for (const pointer of batches)
				if (!sidecar.batches.some((item) => canonicalJson(item) === canonicalJson(pointer)))
					sidecar.batches.push(pointer);
			sidecar.captures.push({ file, capture });
			const text = JSON.stringify(sidecar);
			if (
				Buffer.byteLength(text) > 1024 * 1024 ||
				sidecar.batches.length > 64 ||
				sidecar.captures.length > 4096
			)
				throw new ExpectedCliError('Video capture sidecar exceeds bounded metadata limits.');
			const written = JSON.stringify(line) + '\n';
			if (captureIndexSize(index) + Buffer.byteLength(written) > 2_000_000)
				throw new ExpectedCliError('Video capture index exceeds its 2 MB metadata cap.');
			const temporary = join(directory, `.video-batches-${randomUUID()}.json`);
			writeFileSync(temporary, text);
			renameSync(temporary, path);
			appendCaptureIndex(index, written);
		}
	};
}
function appendCaptureIndex(path: string, text: string): void {
	const fd = openSync(
		path,
		constants.O_WRONLY | constants.O_APPEND | constants.O_CREAT | constants.O_NOFOLLOW,
		0o600
	);
	try {
		const stat = fstatSync(fd);
		if (!stat.isFile() || stat.size + Buffer.byteLength(text) > 2_000_000)
			throw new ExpectedCliError('Capture index is not a bounded regular file.');
		appendFileSync(fd, text);
	} finally {
		closeSync(fd);
	}
}
function captureIndexSize(path: string): number {
	if (!existsSync(path)) return 0;
	const stat = lstatSync(path);
	if (!stat.isFile())
		throw new ExpectedCliError('Capture index must be a regular owned file, never a symlink.');
	return stat.size;
}
function boundedText(path: string, maximum: number): string {
	const stat = lstatSync(path);
	if (!stat.isFile() || stat.size > maximum)
		throw new ExpectedCliError('Video capture sidecar is missing, symlinked or oversized.');
	return readFileSync(path, 'utf8');
}
