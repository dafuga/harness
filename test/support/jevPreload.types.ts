export interface MockRequest {
	model: string;
	questions: Record<string, { criteria: Record<string, unknown> }>;
}
