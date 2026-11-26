// @harness-uid u_rd7ww2qp7q
import type { QaSlackMessage, QaSyncConfig } from '../../../core/agents-providers/qaSync.types';

export interface QaCommentNoteInput {
	config: QaSyncConfig;
	workspaceUrl: string;
	channel: string;
	parentTs: string;
	issue: number;
	comments: readonly QaSlackMessage[];
	/** Why the note landed on this item, when it is not the obvious owner. */
	routing: readonly string[];
}
