import type { MetricHost } from '../../src/utils/explorer-ui/entityMetricComparison.types';
import type { entityMetricComparison } from '../../src/utils/explorer-ui/entityMetricComparison';
import type { unitFor } from './reports.function.explorer-ui-entity-metric-comparison.test';

export type Host = MetricHost;

export type Head = Host['head'];

export type Entity = Parameters<typeof entityMetricComparison>[1];

export type Measure = Parameters<typeof entityMetricComparison>[2];

export type Result = ReturnType<typeof entityMetricComparison>;

export type UnitEntry = ReturnType<typeof unitFor>;
