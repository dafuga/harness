// @harness-uid u_lrganksse4
import type { RunnerInput } from '../../../../../src/core/execution-runtimes/scripted-deploy/approvalInbox.types';

export type RunnerScope = { owner: string; runnerHash: string; now: number };
export type DecisionSession = { owner: string; sessionHash: string; now: number; grants: string };
export type Collect = Extract<RunnerInput, { kind: 'collect' }>;
export type Admit = Extract<RunnerInput, { kind: 'admit' }>;
export type Report = Extract<RunnerInput, { kind: 'report' }>;
export type ApprovalRow = {
	id: string;
	plan: string;
	owner: string;
	card: string;
	receipt: string | null;
	decision: 'allow' | 'deny' | null;
	decided_at: number | null;
	used_at: number | null;
	go_at: number | null;
	progress: string | null;
};
