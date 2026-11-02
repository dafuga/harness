// @harness-uid u_cy5r7zckyu
export interface CodexModel {
	model: string;
	displayName: string;
	hidden: boolean;
	supportedReasoningEfforts: { reasoningEffort: string }[];
	defaultReasoningEffort: string;
	isDefault: boolean;
}
