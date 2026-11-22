import type { svelteAdapter } from '../../src/audit/development-tooling/adapters/svelte';

/**
 * svelteAdapter.audit is called with each Svelte file the way the audit builds it: the path, the
 * contents and the lines derived from them. Each state records the file it was given (its path,
 * extension and contents, or only its path and line count for the file over the line limit) and
 * the findings the adapter returned, in the order it returned them.
 */
export type Audited = {
	name: string;
	input: unknown;
	output: ReturnType<typeof svelteAdapter.audit>;
};
