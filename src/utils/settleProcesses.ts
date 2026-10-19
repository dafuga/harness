import { type Settlement, type Watched } from "./settlementReport";

export type { Settlement, Watched } from './settlementReport';

export interface SettleTiming {
	settleMs: number;
	graceMs: number;
	/** The bound of the whole settling; after it nothing is read, judged or signalled. */
	cleanupMs?: number;
}

export { haltProcesses, settleProcesses } from './run-isolated/settleProcesses';
