export interface TaskProcessResult {
	code: number;
	stdout: string;
}
export interface TaskPublicEvent {
	type: string;
	subtype?: string;
	model?: string;
	is_error?: boolean;
	result?: string;
	error?: string | { type?: string; code?: string };
	rate_limit_info?: { status?: string };
	item?: { type?: string; text?: string };
	modelUsage?: Record<string, unknown>;
}
