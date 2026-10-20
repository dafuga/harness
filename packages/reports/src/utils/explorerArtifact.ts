/** What a recorded value reads as: a sentence as it is, anything structured as indented JSON. */
export function artifactText(value: unknown): string {
	if (value === undefined) return 'Not recorded';
	return typeof value === 'string' ? value : JSON.stringify(value, null, 2);
}

/** What reads the bytes at an address; the browser's fetch, unless a caller gives another. */
export type ArtifactFetcher = (
	address: string
) => Promise<Pick<Response, 'ok' | 'status' | 'arrayBuffer'>>;

export { artifactBehavior, explorerArtifact } from './explorer-reading/explorerArtifact';
