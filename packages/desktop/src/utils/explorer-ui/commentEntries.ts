import type { ThreadMessage } from '../../models/development-tooling/Desktop.types';
import type { HumanCommentResult } from '../../models/projects-sessions/ProjectContext.types';

/** A thread message as it is shown: who wrote it and whether it left this device. */
export interface ThreadEntry extends ThreadMessage {
	authorName?: string;
	pending?: boolean;
	note?: string;
	detail?: string;
}

export type PendingComment = Extract<HumanCommentResult, { kind: 'pending' }>;

export { commentEntries } from '../../adapters/explorer-ui/browser-project-adapter/commentEntries';

export {
	threadInfo,
	pendingEntries,
	requestEntry
} from '../../components/explorer-ui/thread-panel/commentEntries';
