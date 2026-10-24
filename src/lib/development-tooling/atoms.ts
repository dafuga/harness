/** Svelte build integration for Harness native element atoms. */
import { atomicComponents as preprocess } from '../../templates/development-tooling/atomicPreprocess.js';
import type { PreprocessorGroup } from 'svelte/compiler';

export function atomicComponents(options?: {
	aliases?: Record<string, string>;
}): PreprocessorGroup {
	return preprocess(options);
}
