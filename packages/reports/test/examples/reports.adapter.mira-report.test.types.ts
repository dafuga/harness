import type { MiraReportAdapter } from '../../src/services/reports-media/report-command-service/MiraReportAdapter';

export type Store = Parameters<MiraReportAdapter['ingest']>[0];

export type Written = {
	id: string;
	record: { kind: string; data: { id: string; status: string; path?: string } };
};
