// @harness-uid u_xetkmrxgc7
import type { EvidencePointer } from '../../../../core/git-source-history/historyTypes';
import type { EvidenceManifest } from '../../../../core/git-source-history/historyTypes';
import type { VerificationRecord } from '../../../../core/verification-evidence/verificationTypes';

export interface AttachedRecord {
	pointer: EvidencePointer;
	manifest?: EvidenceManifest;
	record?: VerificationRecord;
	/** Original bytes of every file that could be read, by path. */
	files: Map<string, Buffer>;
	problems: string[];
}

export interface AttachedRecordReadOptions {
	trail?: string[];
	notes?: string | null;
	/** Verify media, then discard it; keeps recursive lineage checks from retaining ancestor media. */
	retainMedia?: boolean;
}
export interface AttachedRecordDescriptor {
	pointer: EvidencePointer;
	manifest?: EvidenceManifest;
	record?: VerificationRecord;
	problems: string[];
	integrity: 'metadata-only';
}
