import type { HarnessRevision, HarnessUnit } from '../../src/models/explorer-ui/Harness.types';
import type { recordExampleCases } from '../../../../test/support/recordExampleCases';
import type { projected } from './reports.function.explorer-entities.projection';

export type Helper = NonNullable<HarnessUnit['helpers']>[number];
export type Impact = NonNullable<HarnessRevision['sourceImpact']>;
export type Cases = Parameters<typeof recordExampleCases>[1];

export type Row = NonNullable<ReturnType<typeof projected>>;
