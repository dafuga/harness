import type { Environment } from './contracts';

export type Fields = Record<string, unknown>;
export type Difference = {
	environment: Environment;
	field: string;
	expected: unknown;
	observed: unknown;
	reason: string | null;
};
