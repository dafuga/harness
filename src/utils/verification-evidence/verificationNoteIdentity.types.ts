// @harness-uid u_emck5mljof
import type { HistoryNote } from '../../core/git-source-history/historyTypes';

export type Note = Extract<HistoryNote, { kind: 'verification' }>;
