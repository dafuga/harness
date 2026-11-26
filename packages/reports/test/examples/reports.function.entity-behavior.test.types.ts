import type { view } from '../entityPlaces';
import type { recordExampleCases } from '../../../../test/support/recordExampleCases';

export type Changed = Parameters<typeof view>[1];

export type Case = Parameters<typeof recordExampleCases>[1][number];
