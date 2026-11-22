export type Call = {
	method: string;
	params: Record<string, unknown>;
	options?: Record<string, unknown>;
};
