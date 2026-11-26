export interface FakeResponse {
	ok: boolean;
	json: () => Promise<unknown>;
}

export interface FetchCall {
	url: string;
	cache: string | undefined;
	abortable: boolean;
}
