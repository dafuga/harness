// @harness-uid u_rizfoowd3l
import type { GitAdapter } from '../../../adapters/git-source-history/GitAdapter';
import type { UnitRuntimeService } from '../../../services/execution-runtimes/UnitRuntimeService';
import type { openRange } from '../../development-tooling/loadRevisions';
import type { VerifyOptions } from './runVerify.types';

export interface LocalPlanInput {
	git: GitAdapter;
	commit: string;
	options: VerifyOptions & { root: string };
	runtime: ReturnType<UnitRuntimeService['kernel']>;
	context: {
		baseCommit: string | null;
		baseRecord: string | undefined;
		requestedBase: string | null;
		base: Awaited<ReturnType<typeof openRange>>['base'];
		head: Awaited<ReturnType<typeof openRange>>['head'];
		entity?: string;
	};
}
