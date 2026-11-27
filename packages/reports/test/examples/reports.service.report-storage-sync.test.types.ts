import type { ReportStorageSyncService } from '../../src/services/reports-media/report-command-service/ReportStorageSyncService';

export type Repository = ConstructorParameters<typeof ReportStorageSyncService>[0];

export interface FakeReport {
	id: string;
	startedAt: string;
	evidence: Array<{ file: string; storage: null; missing: boolean }>;
}
