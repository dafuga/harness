import type {
	snapshotVideoFlags,
	pendingVideoEnvironment
} from '../../src/workflows/verification-evidence/run-verify/verification-service/snapshotVideoFlags';

export type Scenarios = Parameters<typeof snapshotVideoFlags>[1];

export type Requirements = Parameters<typeof pendingVideoEnvironment>[1];

export type Repository = { git: (...args: string[]) => string };

export type Failure = { name: string; message: string } | undefined;
