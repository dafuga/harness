import type { reportFilter } from '../../src/components/verification-evidence/evidence-grid/reportFilter';
import type { projectFilter } from '../../src/utils/verification-evidence/reportFilter';

export type Evidence = Parameters<typeof reportFilter>[0][number];

export type Report = Parameters<typeof projectFilter>[0];

export type Status = Evidence['status'];
