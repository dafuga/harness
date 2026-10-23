import type { VerifyRepo } from './support/verifyRepo';
import type { VerifyOutcome } from './support/verifyRepo';

/**
 * A PREPARED BASELINE IS CLEAN OR IT IS REFUSED. `baselineRepo` verifies once more after the
 * baselines are established; the repository is returned only when that verification passed.
 * The fixture and `harness verify` are real. For the refused case the second verification alone
 * runs with FIXTURE_NO_BENCH=1, the switch of the SYNTHETIC fixture benchmark that leaves it
 * without a measurement. Every repository prepared here is disposed, whether a check passes or not.
 */
export type Refusal = Error & { repo?: VerifyRepo; outcome?: VerifyOutcome };
