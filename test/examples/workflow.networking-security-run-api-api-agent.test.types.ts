import type { apiAgent } from '../../src/workflows/networking-security/run-api/apiAgent';

export type ApiClient = Parameters<typeof apiAgent>[0];
