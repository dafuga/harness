export type PickerData = Record<string, unknown>;
export type PickerRpc = (
	method: string,
	params: PickerData,
	options?: PickerData
) => Promise<PickerData>;

export function nativePickerProtocol(value: unknown): PickerData {
	if (!value || typeof value !== 'object' || Array.isArray(value)) return {};
	return value as PickerData;
}

export function pickerProvider(model: unknown): string {
	if (model === 'claude-opus-5-5') return 'harness-claude';
	if (typeof model !== 'string' || model.startsWith('claude-'))
		throw new Error('Unsupported model selection');
	return 'openai';
}

export const nativeOpusModel = {
	id: 'claude-opus-5-5',
	model: 'claude-opus-5-5',
	displayName: 'Claude Opus 5.5 (Harness)',
	description:
		'Claude Code subscription through the local Harness gateway. Native hosted web search is unavailable in this experiment.',
	hidden: false,
	isDefault: false,
	defaultReasoningEffort: 'xhigh',
	supportedReasoningEfforts: [{ reasoningEffort: 'xhigh', description: 'Extra high' }],
	supportsPersonality: false,
	inputModalities: ['text', 'image'],
	availabilityNux: null,
	upgrade: null,
	modelUpgrade: null,
	availableAccessPrograms: null
};
