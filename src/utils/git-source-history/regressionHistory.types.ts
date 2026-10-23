import type { HistoryNote } from '../../core/git-source-history/historyTypes';
import type { RegressionRecord } from '../../core/verification-evidence/regressionTypes';

export type RegressionNote = Extract<HistoryNote, { kind: 'regression' }>;

export type Loaded = { record: RegressionRecord; output: string; files?: Map<string, Buffer> };

export type Loader = (note: RegressionNote) => Promise<Loaded>;
