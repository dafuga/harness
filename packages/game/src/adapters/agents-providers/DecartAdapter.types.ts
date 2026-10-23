import type { createDecartClient } from '@decartai/sdk';

export type TokenClient = ReturnType<typeof createDecartClient>['tokens'];
