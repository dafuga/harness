// @harness-uid u_vyqjqceknl
/** What decides the line under the AI video control. */
export interface PreviewSummaryInput {
	readonly: boolean;
	transportReady: boolean;
	available: boolean;
	status: 'off' | 'starting' | 'live';
	left: number;
	note: string;
	limit: number;
	rate: number;
}
