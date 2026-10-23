export interface Event {
	kind: string;
	pid?: number;
	argv?: string[];
	cwd?: string;
	env?: string[];
	resources?: { lease?: string; cpus?: string; threads?: string };
	method?: string;
	params?: Record<string, unknown>;
	input?: string;
}
