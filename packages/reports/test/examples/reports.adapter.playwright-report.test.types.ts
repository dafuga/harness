import type { PlaywrightReportAdapter } from '../../src/services/reports-media/report-command-service/PlaywrightReportAdapter';

export type Store = Parameters<PlaywrightReportAdapter['ingest']>[0];

export type Written = { id: string; entry: { kind: string; data: Record<string, unknown> } };
