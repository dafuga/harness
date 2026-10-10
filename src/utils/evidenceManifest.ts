import { createHash } from 'node:crypto';
import type { EvidenceManifest } from '../core/historyTypes';
import type { VerificationRecord } from '../core/verificationTypes';
import { lfsStored } from './lfsPointer';

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

/** The manifest stored beside a record: every file with its original hash, size and storage. */
export function evidenceManifest(record: VerificationRecord, recordJson: Buffer): EvidenceManifest {
	const stored = {
		path: 'record.json',
		sha256: createHash('sha256').update(recordJson).digest('hex'),
		bytes: recordJson.length
	};
	return {
		schemaVersion: 1,
		record: record.id,
		source: { commit: record.source.commit, tree: record.source.tree },
		status: record.status,
		files: [stored, ...recordFiles(record)].map((file) => ({
			...file,
			storage: lfsStored(file.path) ? ('lfs' as const) : ('git' as const)
		}))
	};
}
