import type { ExplanationService } from '../../src/services/development-tooling/ExplanationService';

export type Required = Parameters<ExplanationService['report']>[0][number];

export type Reason = Parameters<ExplanationService['report']>[1][number];
