// @harness-uid u_a7rs3z4f6t
export interface CheckReport {
	status: 'passed' | 'failed';
	commit: string;
	record: string;
	problems: string[];
}
