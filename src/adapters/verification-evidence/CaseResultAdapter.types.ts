export interface CaseResultAdapterConfig {
	root?: string;
	directory?: string;
	revision?: string;
}
export interface RunnerTask {
	type: string;
	name: string;
	mode?: string;
	filepath?: string;
	tasks?: RunnerTask[];
	result?: { state: string; retryCount?: number };
}
export interface BrowserCase {
	location: { file: string };
	titlePath(): string[];
}
export interface BrowserResult {
	status: string;
	retry: number;
}
