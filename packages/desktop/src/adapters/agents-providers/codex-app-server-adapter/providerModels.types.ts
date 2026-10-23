export interface CodexModel {
	model: string;
	displayName: string;
	hidden: boolean;
	supportedReasoningEfforts: { reasoningEffort: string }[];
	defaultReasoningEffort: string;
	isDefault: boolean;
}
