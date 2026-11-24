// @harness-uid u_lrganksse4
import type { runnerInput } from '../../../../../src/core/execution-runtimes/scripted-deploy/approvalInbox';
import type { z } from 'zod';

export type RunnerScope = { owner: string; runnerHash: string; now: number };
export type DecisionSession = { owner: string; sessionHash: string; now: number; grants: string };
export type Collect = Extract<z.infer<typeof runnerInput>, { kind: 'collect' }>;
export type ApprovalRow = {
	id: string;
	plan: string;
	owner: string;
	card: string;
	receipt: string | null;
	decision: 'allow' | 'deny' | null;
	decided_at: number | null;
	used_at: number | null;
};
