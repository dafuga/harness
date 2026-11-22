// @harness-uid u_rbmqui6qut
export interface RecordRegressionInput {
	env?: Record<string, string | undefined>;
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
