// @harness-uid u_dfas6iiqrt
import type { VerifyRepo } from '../../../test/support/verifyRepo';
import type { VerifyOutcome } from '../../../test/support/verifyRepo';
import type { CommandResult } from '../../../test/support/cli';

export interface EmittedSeed {
	verified: (repo: VerifyRepo) => Promise<VerifyOutcome>;
	explain: (repo: VerifyRepo, behavior: string) => Promise<CommandResult>;
}
