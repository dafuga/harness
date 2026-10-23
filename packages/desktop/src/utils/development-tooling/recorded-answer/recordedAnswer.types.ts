import type { ExplorerScope } from '../../../../../reports/src/models/Explorer.types';
import type { CacheIdentity } from '../../../../../collaboration/src/models/Collaboration.types';
import type { ExplorerRevisions } from '../../../../../reports/src/utils/explorerEvidence';

export interface AnswerInput {
	/** Where the read is in history, with the entity it is of. */
	scope: ExplorerScope;
	/** What the revisions were read at. */
	identity: CacheIdentity;
	/** The stored revision of the shown commit, and of its first parent where one is compared. */
	revisions: ExplorerRevisions;
}
