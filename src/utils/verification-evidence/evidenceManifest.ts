// @harness-uid u_4jgwbpywc5
import type { RecordFile } from './evidenceManifest.types';
import type { VerificationRecord } from '../../core/verification-evidence/verificationTypes';
import { posix } from 'node:path';

/**
 * The files a record directory holds besides the record itself: the captures this run produced
 * and the log of every check. Inherited scenarios keep their captures with the original record.
 */
export function recordFiles(record: VerificationRecord): RecordFile[] {
	const captures = record.scenarios
		.filter((scenario) => scenario.status !== 'referenced')
		.flatMap((scenario) => scenario.states.flatMap((state) => state.captures))
		.flatMap(({ path, sha256, bytes, mediaType, video }) => {
			const media: RecordFile[] = [{ path, sha256, bytes, mediaType }];
			if (video)
				media.push({
					path: posix.join(posix.dirname(path), video.poster.file),
					sha256: video.poster.sha256,
					bytes: video.poster.bytes,
					mediaType: 'image/png'
				});
			return media;
		});
	const logs = record.tests.map(({ log }) => ({
		path: log.path,
		sha256: log.sha256,
		bytes: log.bytes
	}));
	const seen = new Set<string>();
	return [...captures, ...logs].filter((file) => !seen.has(file.path) && seen.add(file.path));
}

export { evidenceManifest } from '../../services/verification-evidence/evidence-attach-service/evidenceManifest';

export type { RecordFile } from './evidenceManifest.types';
