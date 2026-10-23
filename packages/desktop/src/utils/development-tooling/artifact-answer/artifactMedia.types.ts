export type Recorded = { kind: string; mediaType: string };

export type Sign = (bytes: Uint8Array) => boolean;
