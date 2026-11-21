// @harness-uid u_xghv2ih7cg
import type { GitAdapter } from '../../../adapters/git-source-history/GitAdapter';

export interface ModuleCompletionMeasurement {
	git: GitAdapter;
	source: string[];
	tests: string[];
	command?: string[];
	signal: AbortSignal;
}
