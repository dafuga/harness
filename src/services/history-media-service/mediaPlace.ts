import { MediaFile } from '../../utils/mediaPlace';
import { createHash } from "node:crypto";
import type { ResolvedMedia } from "../../utils/recordView";

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
