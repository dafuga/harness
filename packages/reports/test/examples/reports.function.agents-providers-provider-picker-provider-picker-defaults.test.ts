import { test } from 'vitest';
import { expect } from '../../../../test/verificationExpect';
import { recordExampleCases } from '../../../../test/support/recordExampleCases';
import { pickerDefault } from '../../src/components/agents-providers/provider-picker/providerPickerDefaults';
import type { PickerDefault } from '../../src/components/agents-providers/provider-picker/providerPickerDefaults';
import type { PickerModel } from '../../../../src/core/development-tooling/pickerModelTypes.types';

const claudeChoices = [
	{
		provider: 'harness-claude',
		model: 'claude-sonnet-5-5',
		label: 'Claude Sonnet 5.5',
		efforts: ['medium', 'high'],
		defaultEffort: 'high',
		source: 'local-catalog'
	},
	{
		provider: 'harness-claude',
		model: 'claude-opus-5-5',
		label: 'Claude Opus 5.5',
		efforts: ['low', 'medium', 'high', 'xhigh', 'max'],
		defaultEffort: 'high',
		source: 'local-catalog'
	}
] satisfies PickerModel[];

const openAiChoices = [
	{
		provider: 'openai',
		model: 'gpt-6.1',
		label: 'GPT 6.1',
		efforts: ['medium', 'high'],
		defaultEffort: 'high',
		source: 'local-catalog'
	},
	{
		provider: 'openai',
		model: 'gpt-6.1-terra',
		label: 'GPT 6.1 Terra',
		efforts: ['medium', 'high'],
		defaultEffort: 'high',
		source: 'local-catalog'
	}
] satisfies PickerModel[];

test('Selects provider-specific model and effort defaults', () => {
	const claude = pickerDefault('harness-claude', claudeChoices) satisfies PickerDefault;
	const openai = pickerDefault('openai', openAiChoices) satisfies PickerDefault;
	const empty = pickerDefault('openai', []);
	const cases = [
		{
			name: 'Claude prefers the catalog Opus 5.5 model and xhigh effort',
			input: { provider: 'harness-claude', choices: claudeChoices },
			output: claude
		},
		{
			name: 'Other providers use their first catalog model and default effort',
			input: { provider: 'openai', choices: openAiChoices },
			output: openai
		},
		{
			name: 'An empty catalog returns empty model and effort',
			input: { provider: 'openai', choices: [] },
			output: empty
		}
	];

	expect([claude, openai, empty]).toEqual([
		{ model: 'claude-opus-5-5', effort: 'xhigh' },
		{ model: 'gpt-6.1', effort: 'high' },
		{ model: '', effort: '' }
	]);
	recordExampleCases(
		{
			unitId: 'reports.function.agents-providers-provider-picker-provider-picker-defaults',
			symbol: 'pickerDefault',
			state: 'selects-provider-specific-model-and-effort-defaults',
			evidence: 'examples-cases',
			file: 'selects-provider-specific-model-and-effort-defaults.json'
		},
		cases
	);
});
