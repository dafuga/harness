import { createHash } from 'node:crypto';
import type { ResolvedMedia } from './recordView';

/** One file of a record whose bytes are placed: where it is in the record, and its hash. */
export interface MediaFile {
	path: string;
	sha256: string;
}

/** Says where the bytes of each capture of a record are, or why they are not there. */
export interface MediaPlacer {
	place(bytes: Buffer | undefined, file: MediaFile, gap: string): Promise<ResolvedMedia>;
}

const directory = 'media';

/**
 * Where the original bytes of a capture are kept: named by their hash, with the extension of
 * their file. Bytes that are missing, or that are not the bytes the record names, are the
 * stated gap; nothing stands in for them. Nothing is read or written here.
 */
export function mediaPlace(bytes: Buffer | undefined, file: MediaFile, gap: string): ResolvedMedia {
	const actual = bytes ? createHash('sha256').update(bytes).digest('hex') : undefined;
	if (actual !== file.sha256) return { media: null, gap };
	const extension = /\.([a-z0-9]+)$/i.exec(file.path)?.[1].toLowerCase() ?? 'bin';
	return { media: `${directory}/${file.sha256}.${extension}` };
}

/** Places nothing: it only says of each capture whether its bytes are stored and intact. */
export const checkedMedia: MediaPlacer = {
	place: async (bytes, file, gap) => mediaPlace(bytes, file, gap)
};
