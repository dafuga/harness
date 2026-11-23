import type { denyAll } from '../../src/lib/console';

export type ConsoleRequest = Parameters<typeof denyAll>[0];
