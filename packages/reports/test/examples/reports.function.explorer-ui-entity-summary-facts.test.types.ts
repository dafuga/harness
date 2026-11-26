import type { entitySummaryFacts } from '../../src/components/explorer-ui/entitySummaryFacts';

export type Measure = Parameters<typeof entitySummaryFacts>[0];

export type Row = Measure['performance'][number];

export type Size = Measure['size'][number];
