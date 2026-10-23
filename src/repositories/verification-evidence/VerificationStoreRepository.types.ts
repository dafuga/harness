import type { VerificationRecord } from '../../core/verification-evidence/verificationTypes';

export interface StoredRecord {
	record: VerificationRecord;
	/** Directory holding `record.json`, its evidence and its logs. */
	directory: string;
}
