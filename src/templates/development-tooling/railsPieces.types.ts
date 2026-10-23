export interface ClassEntityTemplate {
	folder: string;
	fileName: string;
	className: string;
	contents: string;
	expectation: string;
}

export interface FunctionTemplate {
	folder: string;
	name: string;
	functionName: string;
	body: string;
	expectation: string;
	call: string;
	expected: string;
}
