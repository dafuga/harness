export interface RecordRegressionInput {
	root?: string;
	loop: string;
	phase: string;
	commit?: string;
	test?: string[];
	unit?: string[];
	command?: string;
	assertion?: string;
	timeout?: string;
}
