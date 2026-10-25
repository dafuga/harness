export interface LoopExampleInput {
	fixture:
		| 'create'
		| 'guidance'
		| 'evaluate'
		| 'repair'
		| 'capture'
		| 'null'
		| 'undefined'
		| 'object';
	template?: string;
}
