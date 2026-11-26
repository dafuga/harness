import type { ReportRetentionService } from '../../src/services/reports-media/report-command-service/report-retention-service/ReportRetentionService';

export type Repository = NonNullable<ConstructorParameters<typeof ReportRetentionService>[0]>;
