import type { Judged } from '../../src/utils/reports-media/settlementReport.types';

export type Standing = Judged['verdict']['standing'];

export interface Entry {
	pid: number;
	started: string;
	standing: Standing;
	reason: string;
	executable: string;
}
