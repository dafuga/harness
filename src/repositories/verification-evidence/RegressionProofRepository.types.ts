import type { HistoryNote } from '../../core/git-source-history/historyTypes';

export type RegressionNote = Extract<HistoryNote, { kind: 'regression' }>;
