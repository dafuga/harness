import type { ComponentManifest } from '../../src/core/unitTypes';

export type Helper = NonNullable<ComponentManifest['helperContracts']>[number];

export type HelperCall = (...args: unknown[]) => unknown;
