export interface AnalyticsContext {
	loop?: string;
	loopRun?: string;
	step?: string;
	task?: string;
	agentModel?: string;
	report?: string;
}
export interface AnalyticsEvent extends AnalyticsContext {
	id: string;
	timestamp: string;
	project: string;
	kind: 'command' | 'loop' | 'step' | 'evaluation' | 'jev';
	action: string;
	historical?: boolean;
	template?: string;
	status?: string;
	durationMs?: number;
	exitCode?: number;
	evaluatorId?: string;
	checkType?: 'response' | 'clean-code';
	requestedModel?: string;
	evaluatorModel?: string;
	fingerprint?: string;
	cached?: boolean;
	inputTokens?: number;
	outputTokens?: number;
}
export interface AnalyticsFilter {
	project?: string;
	loop?: string;
	task?: string;
	model?: string;
	since?: string;
	until?: string;
}
export interface LoopMetric {
	project: string;
	name: string;
	template?: string;
	agentModel: string;
	status: string;
	createdAt: string;
	completedAt?: string;
	durationMs?: number;
	evaluations: number;
}
