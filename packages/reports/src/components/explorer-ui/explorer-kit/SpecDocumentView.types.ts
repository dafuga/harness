// @harness-uid u_mcvctd4jcs
import type {
	TrackerAttachment,
	TrackerAttachmentDocument
} from '../../../../../../src/utils/projects-sessions/trackerAttachment.types';

/** Each screen fetches documents its own way; null means it is not available there. */
export type LoadSpecDocument = (
	attachment: TrackerAttachment
) => Promise<TrackerAttachmentDocument | null>;
