import type { VerifyRepo } from './support/verifyRepo';
import type { VerifyOutcome } from './support/verifyRepo';

export interface Verified {
	repo: VerifyRepo;
	outcome: VerifyOutcome;
}

export interface Declared {
	setup: object[];
	outputs: string[];
	builds: object[];
}
