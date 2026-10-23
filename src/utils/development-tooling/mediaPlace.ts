import type { MediaPlacer } from './mediaPlace.types';
import { mediaPlace } from '../../cli/program/history-index-service/history-media-service/mediaPlace';

/** Places nothing: it only says of each capture whether its bytes are stored and intact. */
export const checkedMedia: MediaPlacer = {
	place: async (bytes, file, gap) => mediaPlace(bytes, file, gap)
};

export { mediaPlace } from '../../cli/program/history-index-service/history-media-service/mediaPlace';

export type { MediaFile, MediaPlacer } from './mediaPlace.types';
