// @harness-uid u_b22codgvrd
import type { CommandResult } from '../../../test/support/cli';
import type { VerifyRepo } from '../../../test/support/verifyRepo';
import type { VerifyOutcome } from '../../../test/support/verifyRepo';

export interface ShellsSeed {
	verified: (repo: VerifyRepo) => Promise<VerifyOutcome>;
	explain: (repo: VerifyRepo, behavior: string) => Promise<CommandResult>;
}
