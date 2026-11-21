// @harness-uid u_pmxlg3sdum
import type { CanonicalValue } from './contracts.types';
import type { Environment } from './contracts';

export type Fields = Record<string, CanonicalValue>;
export type Difference = {
	environment: Environment;
	field: string;
	expected: unknown;
	observed: unknown;
	reason: string | null;
};
