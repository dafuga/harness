import type { HarnessRecord } from '../../../models/explorer-ui/Harness.types';
import type { HarnessUnit } from '../../../models/explorer-ui/Harness.types';

export type Measurement = HarnessRecord['measurements'][number];

export type Budget = HarnessUnit['budgets']['performance'][number];
