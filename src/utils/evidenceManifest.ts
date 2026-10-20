import type { VerificationRecord } from '../core/verificationTypes';

export interface RecordFile {
	path: string;
	sha256: string;
	bytes: number;
	mediaType?: string;
}

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
	return [...captures, ...logs].filter((file) => !seen.has(file.path) && seen.add(file.path));
}

export { evidenceManifest } from '../services/evidence-attach-service/evidenceManifest';
