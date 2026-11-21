// @harness-uid u_4jgwbpywc5
import type { RecordFile } from './evidenceManifest.types';
import type { VerificationRecord } from '../../core/verification-evidence/verificationTypes';

/**
 * The files a record directory holds besides the record itself: the captures this run produced
 * and the log of every check. Inherited scenarios keep their captures with the original record.
 */
export function recordFiles(record: VerificationRecord): RecordFile[] {
	const captures = record.scenarios
		.filter((scenario) => scenario.status !== 'referenced')
		.flatMap((scenario) => scenario.states.flatMap((state) => state.captures))
		.map(({ path, sha256, bytes, mediaType }) => ({ path, sha256, bytes, mediaType }));
	const logs = record.tests.map(({ log }) => ({
		path: log.path,
		sha256: log.sha256,
		bytes: log.bytes
	}));
	const seen = new Set<string>();
	const retained = record.retainedArtifact
		? [
				{
					path: record.retainedArtifact.path,
					bytes: record.retainedArtifact.bytes,
					sha256: record.retainedArtifact.sha256
				}
			]
		: [];
	return [...captures, ...logs, ...retained].filter(
		(file) => !seen.has(file.path) && seen.add(file.path)
	);
}

export { evidenceManifest } from '../../services/verification-evidence/evidence-attach-service/evidenceManifest';

export type { RecordFile } from './evidenceManifest.types';
