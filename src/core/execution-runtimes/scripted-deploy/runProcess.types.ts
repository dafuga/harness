// @harness-uid u_b5ysx34qie
export type RunProcessOptions = {
	description: string;
	timeout?: number;
	signal?: AbortSignal;
	stdin?: unknown;
	cwd?: string;
};
