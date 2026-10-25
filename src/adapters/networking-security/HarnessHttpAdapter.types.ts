export interface HarnessHttpAdapterConfig {
	url: string;
	token?: string;
	timeout?: number;
}

export interface ApiRequest {
	query?: Array<[string, string]>;
	input?: unknown;
	token?: string;
}

export interface ApiResponse {
	data: unknown;
	bytes: Uint8Array;
	mediaType: string;
}
