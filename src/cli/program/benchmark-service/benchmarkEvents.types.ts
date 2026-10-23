export interface RunnerEvent {
	type?: string;
	subtype?: string;
	thread_id?: string;
	session_id?: string;
	model?: string;
	is_error?: boolean;
	usage?: {
		input_tokens?: number;
		output_tokens?: number;
		cached_input_tokens?: number;
		cache_read_input_tokens?: number;
	};
	total_cost_usd?: number;
}
