import type { VerificationRecord } from '../../core/verification-evidence/verificationTypes';

export interface LineageSource {
	/** The stored record with this id, if there is one. */
	find(id: string): VerificationRecord | undefined;
	/** Identity, seal and evidence problems of one record. */
	problems(record: VerificationRecord): string[];
}

export type Soundness = (dependency: VerificationRecord) => string | undefined;
