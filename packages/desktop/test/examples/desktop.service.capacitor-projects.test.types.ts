import type { CapacitorProjectsServiceConfig } from '../../src/lib/verification-evidence/select-environment/CapacitorProjectsService.types';
import type { recordExampleCases } from '../../../../test/support/recordExampleCases';

export type Bridge = CapacitorProjectsServiceConfig['cloud'];

export type Methods = Record<string, unknown>;

export type Cases = Parameters<typeof recordExampleCases>[1];
