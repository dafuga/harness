/** What a recorded value reads as: a sentence as it is, anything structured as indented JSON. */
export function artifactText(value: unknown): string {
	if (value === undefined) return 'Not recorded';
	return typeof value === 'string' ? value : JSON.stringify(value, null, 2);
}

export { artifactBehavior, explorerArtifact } from './explorer-reading/explorerArtifact';

export type { ArtifactFetcher } from './explorerArtifact.types';
