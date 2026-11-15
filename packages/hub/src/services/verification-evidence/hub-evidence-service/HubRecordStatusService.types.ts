// @harness-uid u_kdcxpa2qb2
import type { HistoryNote } from '../../../../../../src/core/historyTypes';
import type { ReadNote } from '../../../../../../src/utils/git-source-history/note-lines/noteCommit';
import type { HubAttachedService } from './hub-attached-service/HubAttachedService';

export type VerificationNote = Extract<HistoryNote, { kind: 'verification' }>;

export interface Context {
	notes: Promise<Map<string, ReadNote>>;
	attached: HubAttachedService;
	tree: (commit: string) => Promise<string | undefined>;
}
