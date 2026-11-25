// @harness-uid u_2knliavbo7
export { ArtifactMediaError } from './ArtifactMediaError';

export type Recorded = { kind: string; mediaType: string };

export type Sign = (bytes: Uint8Array) => boolean;
