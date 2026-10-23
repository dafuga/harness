import type { HistoryNote } from '../../core/git-source-history/historyTypes';

export type Note = Extract<HistoryNote, { kind: 'verification' }>;
