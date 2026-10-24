export interface ApiRequestObservation {
	url: string;
	httpMethod: string;
	operation: string;
	authorization: string | undefined;
	input: Record<string, unknown>;
	body: Record<string, unknown>;
}
