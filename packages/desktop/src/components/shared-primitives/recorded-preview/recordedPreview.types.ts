import type { RecordedThumbnail } from '../../../utils/shared-primitives/recordedPreview';

export type PreviewPick = Required<Omit<RecordedThumbnail, 'source'>>;
