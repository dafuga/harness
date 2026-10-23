/** What reads the bytes at an address; the browser's fetch, unless a caller gives another. */
export type ArtifactFetcher = (
	address: string
) => Promise<Pick<Response, 'ok' | 'status' | 'arrayBuffer'>>;
