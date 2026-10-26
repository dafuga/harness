import type { unit } from '../explorerFixture';

type UnitFields = NonNullable<Parameters<typeof unit>[2]>;
/** Each authored input is the id, kind and fields that the shared explorer unit fixture builds. */
export type UnitInput = [id: string, kind: string, fields: UnitFields];
