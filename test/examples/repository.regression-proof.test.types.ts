import type { RegressionRecord } from '../../src/core/verification-evidence/regressionTypes.types';
import type { recordExampleCases } from '../support/recordExampleCases';

export type Draft = Omit<RegressionRecord, 'id'>;

export type Source = Draft['source'];

export type Phase = Draft['phase'];

export type Shot = NonNullable<Draft['captures']>[number];

export type Cases = Parameters<typeof recordExampleCases>[1];
