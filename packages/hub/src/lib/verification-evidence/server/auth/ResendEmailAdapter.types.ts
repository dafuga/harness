export interface ResendEmailAdapterConfig {
	apiKey: string;
	from: string;
	fetch: typeof fetch;
}
