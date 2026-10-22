import { mediaPlace } from '../../cli/program/history-index-service/history-media-service/mediaPlace';
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

/** Places nothing: it only says of each capture whether its bytes are stored and intact. */
export const checkedMedia: MediaPlacer = {
	place: async (bytes, file, gap) => mediaPlace(bytes, file, gap)
};

export { mediaPlace } from '../../cli/program/history-index-service/history-media-service/mediaPlace';
