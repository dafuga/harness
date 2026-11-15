// @harness-uid u_mqlnjtpu6l
import type { VerificationRecord } from '../../core/verification-evidence/verificationTypes';

export interface LineageSource {
	/** The stored record with this id, if there is one. */
	find(id: string): VerificationRecord | undefined;
	/** Identity, seal and evidence problems of one record. */
	problems(record: VerificationRecord): string[];
	/** Optional clip-local identity proof; selected media must already have been validated by the caller. */
	clipProblems?(record: VerificationRecord): string[];
}

export type Soundness = (dependency: VerificationRecord) => string | undefined;

export interface RecordLinks {
	source: { baseRecord?: string | null };
	scenarios: Array<{
		referencedRecord?: string | null;
		status?: string;
		states?: Array<{ captures?: Array<{ videoReference?: { record?: string } }> }>;
	}>;
}

export interface VideoOriginRecord {
	id: string;
	source: Pick<VerificationRecord['source'], 'commit' | 'tree'>;
	status: VerificationRecord['status'];
	failures: string[];
	components: Array<Pick<VerificationRecord['components'][number], 'unit' | 'change'>>;
	tests: Array<Pick<VerificationRecord['tests'][number], 'status'>>;
	builds?: Array<{ buildId: string }>;
	videoBatches?: VerificationRecord['videoBatches'];
	scenarios: Array<{
		status: VerificationRecord['scenarios'][number]['status'];
		testedRevision: string;
		states: Array<{
			captures: VerificationRecord['scenarios'][number]['states'][number]['captures'];
		}>;
	}>;
}
