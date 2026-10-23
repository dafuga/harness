import type { VerificationRecord } from '../../src/core/verificationTypes';
import type { UnitProject } from './unitProject';
import type { CommandResult } from './cli';

export interface VerifyOutcome {
	exitCode: number;
	stderr: string;
	record: VerificationRecord;
	/** Scratch directory holding the record, evidence and logs. */
	directory: string;
}

export interface VerifyRepo extends UnitProject {
	git(args: string[]): Promise<string>;
	commit(message: string): Promise<string>;
	/** Explains every currently required change with one generic reason. */
	explainAll(range?: string[]): Promise<void>;
	verify(args?: string[], env?: Record<string, string>): Promise<VerifyOutcome>;
	/** Edits, explains and commits one file, returning the new commit. */
	change(path: string, edit: (source: string) => string): Promise<string>;
	run(args: string[], env?: Record<string, string>): Promise<CommandResult>;
	dispose(): Promise<void>;
}
