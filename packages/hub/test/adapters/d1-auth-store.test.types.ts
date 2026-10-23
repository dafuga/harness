import type { sqlite } from './d1-auth-store.test';

export type Engine = InstanceType<NonNullable<typeof sqlite>['DatabaseSync']>;

export type Value = string | number | null;
