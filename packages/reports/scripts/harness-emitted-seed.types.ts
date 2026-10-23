import type { VerifyRepo } from '../../../test/support/verifyRepo';
import type { VerifyOutcome } from '../../../test/support/verifyRepo';

export interface EmittedSeed {
	verified: (repo: VerifyRepo) => Promise<VerifyOutcome>;
	explain: (repo: VerifyRepo, behavior: string) => Promise<unknown>;
}
