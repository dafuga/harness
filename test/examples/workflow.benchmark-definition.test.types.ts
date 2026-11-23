import type { withTempRepo } from '../support/temporary';
import type { recordExampleCases } from '../support/recordExampleCases';

export type Repository = Parameters<Parameters<typeof withTempRepo>[0]>[0];

export type Cases = Parameters<typeof recordExampleCases>[1];
