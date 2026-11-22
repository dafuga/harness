import type { RatchetBase } from '../../scripts/debt-ratchet-base.types';

/**
 * selectRatchetBase is called the way check-debt-ratchets calls it: with a reader that runs one
 * git command in the checkout and throws when git fails, and with the environment map. Each state
 * builds one temporary Git fixture with withTempRepo, removed afterwards. Environment values are
 * made-up examples; none is read from the process.
 */
export type Repository = { root: string; git: (...args: string[]) => string };

export type Environment = Record<string, string>;

export type Case = {
	name: string;
	input: { env: Environment; refs: string[] };
	output: RatchetBase;
};
