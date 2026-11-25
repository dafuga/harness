import type { composeHubAuth } from '../../src/lib/verification-evidence/server/auth/composeHubAuth';

export type Hub = ReturnType<typeof composeHubAuth>;
