// @harness-uid u_rqnpef7fhf
import type { RecordedThumbnail } from '../../../utils/shared-primitives/recordedPreview';

export type PreviewPick = Required<Omit<RecordedThumbnail, 'source'>>;
export { RecordedPreviewError } from './RecordedPreviewError';
