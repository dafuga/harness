import type { VerifyOutcome, VerifyRepo } from '../../../../test/support/verifyRepo';
import type { SeedAttacher } from '../../scripts/harness-seed-attacher';

/** Verifies the repository and attaches the record to the commit it ran on. */
export type Verified = (
	repo: VerifyRepo,
	env?: Record<string, string>,
	args?: string[]
) => Promise<VerifyOutcome>;

/** The state one seeding run threads through its phases. */
export interface ConsoleSeed {
	root: string;
	repo: VerifyRepo;
	attacher: SeedAttacher;
	commits: Record<string, string>;
	verified: Verified;
}
