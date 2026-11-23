import type { JobStatisticsService } from '../../src/services/execution-runtimes/JobStatisticsService';

export type Row = ConstructorParameters<typeof JobStatisticsService>[0][number];
