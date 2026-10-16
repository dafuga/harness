import type { ChangeStatus, Sha256 } from './Planning.types';
/** Observed structured CLI file operations; shell-write coverage is explicitly incomplete. */
export interface HostFileChange {
	path: string;
	before: string | null;
	after: string | null;
	coverage: 'observed-cli-file-operation';
}
/** The exact currently approved design that a code request names. */
export interface ChangeTarget {
	approvalId: string;
	version: string;
	/** Null only for an approved notes-only design. */
	imageSha256: Sha256 | null;
	contractHash: Sha256;
}
/** Completed is a CLI outcome; verification is always recorded separately. */
export interface ChangeRecord {
	target: ChangeTarget;
	status: ChangeStatus;
	changedPaths: string[];
	hostChanges?: HostFileChange[];
	error: string | null;
}
