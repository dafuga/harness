import type { ReplayStorageService } from '../../src/services/reports-media/ReplayStorageService';

export type Report = Parameters<ReplayStorageService['store']>[0];
