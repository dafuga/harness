export type RunProcessOptions = {
	description: string;
	timeout?: number;
	signal?: AbortSignal;
	stdin?: unknown;
	cwd?: string;
};
