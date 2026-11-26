// @harness-uid u_q3g6hgpawh
import type { RegressionNote } from '../../core/git-source-history/historyTypes.types';

import type { RegressionRecord } from '../../core/verification-evidence/regressionTypes';

export type Loaded = { record: RegressionRecord; output: string; files?: Map<string, Buffer> };

export type Loader = (note: RegressionNote) => Promise<Loaded>;
