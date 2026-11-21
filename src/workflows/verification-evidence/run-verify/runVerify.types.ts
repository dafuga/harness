// @harness-uid u_srtmrphmgz
import type { StoredRecord } from '../../../repositories/verification-evidence/VerificationStoreRepository';

/** Attachment is separate from the sealed record: focused proof is never a full pass. */
export interface VerifyResult extends StoredRecord {
	attachment?: {
		status: 'attached' | 'unchanged' | 'skipped';
		entity: string;
		record: string;
		states: string[];
		viewports: string[];
	};
}

export interface VerifyOptions {
	priority?: string;
	/** Mandatory for task completion; historical verification contracts remain readable. */
	requirePerformance?: boolean;
	root?: string;
	/** Commit to verify; `HEAD` by default. Uncommitted changes are never part of it. */
	commit?: string;
	/**
	 * Revision to compare against; the first parent by default. It is used only when a passing
	 * record proves it; otherwise the nearest proven ancestor is used, or nothing at all.
	 */
	base?: string;
	runtime?: string;
	/** Verify only this entity's scenario states; the record is partial and never passes. */
	entity?: string;
	/** A declared generated file to retain from a passing full verification. */
	retainArtifact?: string;
	testTimeout?: string;
	record?: string;
}
