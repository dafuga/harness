import type { Evidence } from '../../models/reports-media/Report.types';

export type Comparable = Evidence & { phase: 'before' | 'after'; comparison: string };
