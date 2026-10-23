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
