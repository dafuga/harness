import type { z } from 'zod';
import type { benchmarkDefinitionSchema } from '../../cli/program/benchmark-service/benchmark-definition/BenchmarkDefinitionValidator';

export type BenchmarkDefinition = z.infer<typeof benchmarkDefinitionSchema>;
export type BenchmarkCandidate = BenchmarkDefinition['candidates'][number];
export type TrialStatus =
	| 'running'
	| 'passed'
	| 'failed'
	| 'invalid'
	| 'timeout'
	| 'error'
	| 'interrupted';
export interface BenchmarkUsage {
	inputTokens?: number;
	outputTokens?: number;
	cacheReadTokens?: number;
	reportedCostUsd?: number;
}
export interface BenchmarkTurn {
	session: string;
	reportedModel?: string;
	usage: BenchmarkUsage;
}
export interface BenchmarkRunnerInput {
	candidate: BenchmarkCandidate;
	cwd: string;
	prompt: string;
	session?: string;
	signal: AbortSignal;
}
export interface BenchmarkRunner {
	preflight(candidate: BenchmarkCandidate): Promise<string>;
	run(input: BenchmarkRunnerInput): Promise<BenchmarkTurn>;
}
export interface BenchmarkCheck {
	id: string;
	exitCode: number;
	durationMs: number;
	stdout: string;
	stderr: string;
}
export interface BenchmarkSubmission {
	passed: boolean;
	invalidFiles: string[];
	checks: BenchmarkCheck[];
	patch: string;
}
export interface BenchmarkTrial {
	id: string;
	candidate: string;
	repetition: number;
	status: TrialStatus;
	firstSubmissionPassed?: boolean;
	submissions: BenchmarkSubmission[];
	turns: BenchmarkTurn[];
	agentDurationMs: number;
	evaluationDurationMs: number;
	durationMs: number;
	repairs: number;
	error?: string;
}
export interface BenchmarkRun {
	version: 1;
	id: string;
	project: string;
	revision: string;
	fingerprint: string;
	seed: string;
	definition: BenchmarkDefinition;
	runnerVersions: Record<string, string>;
	startedAt: string;
	ownerPid?: number;
	completedAt?: string;
	trials: BenchmarkTrial[];
}
