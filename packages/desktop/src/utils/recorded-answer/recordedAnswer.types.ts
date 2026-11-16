// @harness-uid u_lkzrod2wrf
import type { ExplorerScope } from '$reports/models/explorer-ui/Explorer.types';
import type { CacheIdentity } from '../../../../collaboration/src/models/planning-collaboration/Collaboration.types';
import type { ExplorerRevisions } from '$reports/utils/explorer-ui/explorerEvidence';

export interface AnswerInput {
	/** Where the read is in history, with the entity it is of. */
	scope: ExplorerScope;
	/** What the revisions were read at. */
	identity: CacheIdentity;
	/** The stored revision of the shown commit, and of its first parent where one is compared. */
	revisions: ExplorerRevisions;
}

/** An answer too large for one message of any transport, refused rather than cut short. */
export class AnswerTooLargeError extends Error {
	override name = 'AnswerTooLargeError';
}
