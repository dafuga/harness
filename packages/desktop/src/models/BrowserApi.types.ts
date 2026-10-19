export type Query = Record<string, string | null | undefined>;

export interface BrowserApi {
	media(path: string, query?: Query): Promise<{ bytes: Uint8Array; mediaType: string }>;
	get<T>(path: string, query?: Query): Promise<T>;
	send<T>(method: 'POST' | 'DELETE', path: string, body?: unknown): Promise<T>;
	bytes(path: string, query?: Query): Promise<Uint8Array>;
}

export interface ApiFailure extends Error {
	status: number;
	code: string;
}
