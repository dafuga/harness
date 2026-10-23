import type { SignedInput } from '../../workflows/verification-evidence/run-budget/runBudget';
import type { BenchInput } from '../../workflows/verification-evidence/run-budget/runBudget';

export type Flags = Partial<SignedInput> & Partial<BenchInput> & { json?: boolean };
