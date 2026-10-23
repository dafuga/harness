import type { VerifyOutcome } from './support/verifyRepo';
import type { VerifyRepo } from './support/verifyRepo';
import type { Attached } from './support/historyRepo';

export interface Manifest {
	record: string;
	source: { commit: string; tree: string };
	status: string;
	files: Array<{ path: string; sha256: string; bytes: number; storage: string }>;
}

export type TestedRecord = VerifyOutcome['record'];

export interface Stored {
	repo: VerifyRepo;
	record: TestedRecord;
	attached: Attached;
	head: string;
	tree: string;
}
