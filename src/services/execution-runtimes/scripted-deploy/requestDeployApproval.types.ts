// @harness-uid u_2gix6yvno4
import type { Journal, Plan } from '../../../core/execution-runtimes/scripted-deploy/contracts';

export type ApprovalContext = {
	plan: Plan;
	chain: Journal | null;
	differences: number;
	controlled?: boolean;
	rollbackFrom?: string;
};
