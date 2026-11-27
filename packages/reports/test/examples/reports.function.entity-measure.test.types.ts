import type * as harness from '../../src/models/explorer-ui/Harness.types';
import type { recordExampleCases } from '../../../../test/support/recordExampleCases';

export type Measurement = harness.HarnessRecord['measurements'][number];

export type Budget = harness.HarnessUnit['budgets']['performance'][number];

export type Cases = Parameters<typeof recordExampleCases>[1];

export type Patch = Partial<harness.HarnessUnit>;
