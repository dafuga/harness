import type { recordExampleCases } from '../support/recordExampleCases';
import type { settleProcesses } from '../../src/utils/reports-media/run-isolated/settleProcesses';

export type Cases = Parameters<typeof recordExampleCases>[1];

export type Outcome = Awaited<ReturnType<typeof settleProcesses>>;
