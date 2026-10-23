export interface CheckReport {
	status: 'passed' | 'failed';
	commit: string;
	record: string;
	problems: string[];
}
