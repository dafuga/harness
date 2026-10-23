export interface Event {
	kind: string;
	pid?: number;
	argv?: string[];
	cwd?: string;
	env?: string[];
	method?: string;
	params?: Record<string, unknown>;
	input?: string;
}
