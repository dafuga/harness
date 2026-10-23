import type { owner } from './support/gatedRuns';

export type Owner = Awaited<ReturnType<typeof owner>>;
