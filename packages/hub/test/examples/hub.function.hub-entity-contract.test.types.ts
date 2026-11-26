import type { hubEntityContract } from '../../src/routes/api/[...path]/hub-projection-service/hubEntityContract';

export type UnitArg = NonNullable<Parameters<typeof hubEntityContract>[0]>;

export type PlanArg = NonNullable<Parameters<typeof hubEntityContract>[1]>;
