// @harness-uid u_rw64iex44n
export interface InputPart {
	hash: string;
	tokens: number;
}

export interface RequestContext {
	fields: Map<string, InputPart>;
	items: InputPart[];
	incremental: boolean;
	tokens: number;
}

export type CountInputTokens = (input: string) => number;
