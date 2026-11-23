import type { renderContractCheck } from '../../src/workflows/development-tooling/guide-units/checkUnitContracts';
import type { recordExampleCases } from '../support/recordExampleCases';

export type Report = Parameters<typeof renderContractCheck>[0];

export type Cases = Parameters<typeof recordExampleCases>[1];
