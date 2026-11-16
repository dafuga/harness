// @harness-uid u_2knliavbo7
export class ArtifactMediaError extends Error {
	override name = 'ArtifactMediaError';
}

export type Recorded = { kind: string; mediaType: string };

export type Sign = (bytes: Uint8Array) => boolean;
