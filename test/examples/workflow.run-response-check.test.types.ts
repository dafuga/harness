import type {
	ResponseCheckOptions,
	ResponseCheckStatus
} from '../../src/core/verification-evidence/responseCheckTypes';

export type Captured = {
	printed: string;
	exitCode: typeof process.exitCode;
	error?: { name: string; message: string };
};

export type Row = {
	name: string;
	input: ResponseCheckOptions;
	options: ResponseCheckOptions;
	status: ResponseCheckStatus;
	error?: string;
};
