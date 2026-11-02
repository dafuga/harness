import { expect, test } from 'vitest';
import { pickerDefault } from '../../src/components/agents-providers/provider-picker/providerPickerDefaults';

const model = (name: string, efforts: string[], defaultEffort = efforts[0]) =>
	({ provider: 'x', model: name, label: name, efforts, defaultEffort }) as never;

test('Claude prefers Opus 5.5 at extra-high effort when that model offers it', () => {
	const choices = [model('claude-sonnet-5-5', ['low']), model('claude-opus-5-5', ['low', 'xhigh'])];
	expect(pickerDefault('harness-claude', choices)).toEqual({
		model: 'claude-opus-5-5',
		effort: 'xhigh'
	});
});

test('another provider takes its first model and that model default effort', () => {
	const choices = [model('gpt-a', ['low', 'high'], 'high'), model('claude-opus-5-5', ['xhigh'])];
	expect(pickerDefault('openai', choices)).toEqual({ model: 'gpt-a', effort: 'high' });
});

test('a provider without models has an empty selection', () => {
	expect(pickerDefault('openai', [])).toEqual({ model: '', effort: '' });
});
