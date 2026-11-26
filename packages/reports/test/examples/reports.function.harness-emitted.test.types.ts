import type { harnessEmitted } from '../../src/utils/harnessEmitted';

export type Unit = Parameters<typeof harnessEmitted>[0];

export type Snapshot = NonNullable<Parameters<typeof harnessEmitted>[1]>;
