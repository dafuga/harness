import type { cloudflareSafety } from '../../src/utils/networking-security/cloudflareSafety';

export type Config = Record<string, unknown>;

export type Targets = Parameters<typeof cloudflareSafety>[1];
