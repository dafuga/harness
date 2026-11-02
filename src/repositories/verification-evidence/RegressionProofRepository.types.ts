// @harness-uid u_4de62mowqb
import type { HistoryNote } from '../../core/git-source-history/historyTypes';

export type RegressionNote = Extract<HistoryNote, { kind: 'regression' }>;
