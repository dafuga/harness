/** A documented case: its call's output equals `expected`, or its call throws `throws` (a class or message). */
export type CaseExample = { title: string; call: string } & (
	| { expected: string; identity?: boolean }
	| { throws: string }
);

/** A method call run on a fresh instance after its declared initialization and lifecycle steps. */
export type ClassCase = CaseExample & {
	init?: string;
	arrange?: string[];
	steps?: string[];
	checks?: CaseExample[];
};

export interface ClassEntityTemplate {
	folder: string;
	fileName: string;
	className: string;
	contents: string;
	cases: ClassCase[];
}

export interface FunctionTemplate {
	folder: string;
	name: string;
	functionName: string;
	body: string;
	examples: CaseExample[];
}
