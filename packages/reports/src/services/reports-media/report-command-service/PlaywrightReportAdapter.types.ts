import type { ReportRepository } from '../../../repositories/reports-media/report-repository/ReportRepository';
import type { Status } from '../../../models/reports-media/Report.types';

export type PwResult = {
	status?: string;
	duration?: number;
	attachments?: { name: string; path?: string }[];
};

export type PwTest = { status?: string; results?: PwResult[] };

export type PwSpec = { title?: string; tests?: PwTest[] };

export type PwSuite = { specs?: PwSpec[]; suites?: PwSuite[] };

export type Context = { store: ReportRepository; id: string; file: string };

export type Meta = { status: Status; checkId: string; index: number; result?: PwResult };
