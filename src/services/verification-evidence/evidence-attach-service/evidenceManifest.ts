import { recordFiles } from '../../../utils/verification-evidence/evidenceManifest';
import { createHash } from 'node:crypto';
import type { EvidenceManifest } from '../../../core/git-source-history/historyTypes';
import type { VerificationRecord } from '../../../core/verification-evidence/verificationTypes';
import { lfsStored } from '../../../utils/verification-evidence/lfsPointer';

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
