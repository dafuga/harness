import type { EvidenceStorageService } from '../../src/services/verification-evidence/EvidenceStorageService';

export type Report = Parameters<EvidenceStorageService['store']>[0];
