import type { HarnessRevision } from '../../models/explorer-ui/Harness.types';

/** The stored revisions a page has read: the shown one, and its first parent when it has one. */
export interface ExplorerRevisions {
	head: HarnessRevision;
	/** Null when there is none or it is not stored; undefined while it is being read. */
	parent: HarnessRevision | null | undefined;
}

export type Named = { id: string };
