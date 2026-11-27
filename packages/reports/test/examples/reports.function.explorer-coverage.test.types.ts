import type { recordExampleCases } from '../../../../test/support/recordExampleCases';
import type { HarnessRevision } from '../../src/models/explorer-ui/Harness.types';

export type Cases = Parameters<typeof recordExampleCases>[1];

export type Comparison = NonNullable<HarnessRevision['comparison']>;
