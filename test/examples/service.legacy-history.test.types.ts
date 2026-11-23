import type { LegacyHistoryService } from '../../src/cli/program/LegacyHistoryService';

export type Media = Parameters<LegacyHistoryService['entries']>[0];
