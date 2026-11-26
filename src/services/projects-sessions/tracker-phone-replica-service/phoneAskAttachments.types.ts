// @harness-uid u_ygcms2sqfs
import type {
	TrackerAttachment,
	TrackerAttachmentDocument
} from '../../../utils/projects-sessions/trackerAttachment.types';

export type PhoneAttachment = TrackerAttachment & { content?: TrackerAttachmentDocument };
