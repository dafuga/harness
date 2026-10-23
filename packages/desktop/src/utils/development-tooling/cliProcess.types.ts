export interface ProcessOptions {
	cwd?: string;
	input?: string;
	signal?: AbortSignal;
	onLine?: (line: string) => void;
	timeoutMs?: number;
	maxBytes?: number;
}
