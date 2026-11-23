import type { neededBuilds } from '../../src/workflows/verification-evidence/run-verify/verification-service/buildScope';

export type Scenario = Parameters<typeof neededBuilds>[0][number];
