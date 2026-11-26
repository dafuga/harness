export type Handler = (request: Request) => Promise<Response>;

export type RecordMeta = {
	unitId: string;
	symbol: string;
	state: string;
	evidence: string;
	file: string;
};

export type Summary = {
	status: number;
	etag: string | null;
	contentType: string | null;
	body: string;
};
