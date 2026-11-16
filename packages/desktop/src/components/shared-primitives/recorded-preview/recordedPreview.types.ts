// @harness-uid u_rqnpef7fhf
import type { RecordedThumbnail } from '../../../utils/shared-primitives/recordedPreview';

export type PreviewPick = Required<Omit<RecordedThumbnail, 'source'>>;

/** A recorded preview refused by a check on its evidence, its thumbnail binding, or its bytes. */
export class RecordedPreviewError extends Error {
	override name = 'RecordedPreviewError';
}
