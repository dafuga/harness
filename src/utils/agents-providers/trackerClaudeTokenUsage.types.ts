export interface ClaudeMessageUsage {
	id: string;
	model?: string;
	usage: Record<string, unknown>;
}
