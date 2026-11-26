// @harness-uid u_tjjmc723tj
export interface ClaudeMessageUsage {
	id: string;
	model?: string;
	usage: Record<string, unknown>;
}

export interface ClaudeTokenTotals {
	input_tokens: number;
	output_tokens: number;
	cache_read_tokens: number;
	cache_write_tokens: number;
	cost_usd: number | null;
}
