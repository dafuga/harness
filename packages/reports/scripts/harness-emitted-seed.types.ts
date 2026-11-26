// @harness-uid u_dfas6iiqrt
import type { VerifyRepo, VerifyOutcome } from '../../../test/support/verifyRepo';
import type { CommandResult } from '../../../test/support/cli';

export interface VerificationSeed {
	verified: (repo: VerifyRepo) => Promise<VerifyOutcome>;
	explain: (repo: VerifyRepo, behavior: string) => Promise<CommandResult>;
}
