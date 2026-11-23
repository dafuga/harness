import { test } from 'vitest';
import { expect } from '../verificationExpect';
import { recordExampleCases } from '../support/recordExampleCases';
import {
	nativePickerProtocol,
	pickerProvider,
	nativeOpusModel
} from '../../src/utils/development-tooling/nativePickerProtocol';
import { UnsupportedModelSelectionError } from '../../src/utils/development-tooling/nativePickerProtocol.types';

const unitId = 'function.native-picker-protocol';
const picker = { model: 'claude-opus-5-5' };

function meta(symbol: string, state: string) {
	return { unitId, symbol, state, evidence: 'examples-cases', file: `${state}.json` };
}

function providerCase(name: string, model: unknown) {
	try {
		return { name, input: model, output: pickerProvider(model) };
	} catch (error) {
		const failure = error as Error;
		return {
			name,
			input: model,
			error: { name: failure.name, message: failure.message }
		};
	}
}

test('Normalizes protocol values into picker objects', () => {
	expect(nativePickerProtocol(picker)).toBe(picker);
	expect(nativePickerProtocol(null)).toEqual({});
	expect(nativePickerProtocol(['claude-opus-5-5'])).toEqual({});
	expect(nativePickerProtocol('claude-opus-5-5')).toEqual({});
	recordExampleCases(
		meta('nativePickerProtocol', 'normalizes-protocol-values-into-picker-objects'),
		[
			{ name: 'object is returned as the same reference', input: picker, output: picker },
			{ name: 'null is replaced by an empty object', input: null, output: {} },
			{
				name: 'array is replaced by an empty object',
				input: ['claude-opus-5-5'],
				output: {}
			},
			{
				name: 'string is replaced by an empty object',
				input: 'claude-opus-5-5',
				output: {}
			}
		]
	);
});

test('Maps model selections to providers and rejects others', () => {
	expect(pickerProvider('claude-opus-5-5')).toBe('harness-claude');
	expect(pickerProvider('gpt-5')).toBe('openai');
	expect(() => pickerProvider('claude-sonnet-5-5')).toThrow(UnsupportedModelSelectionError);
	expect(() => pickerProvider(42)).toThrow(UnsupportedModelSelectionError);
	recordExampleCases(
		meta('pickerProvider', 'maps-model-selections-to-providers-and-rejects-others'),
		[
			providerCase('Opus 5.5 selection maps to harness-claude', 'claude-opus-5-5'),
			providerCase('gpt-5 selection maps to openai', 'gpt-5'),
			providerCase('other claude model is rejected', 'claude-sonnet-5-5'),
			providerCase('nonstring selection is rejected', 42)
		]
	);
});

test('Exposes the Claude Opus 5.5 catalog entry', () => {
	expect(nativeOpusModel.id).toBe('claude-opus-5-5');
	expect(nativeOpusModel.isDefault).toBe(false);
	expect(nativeOpusModel.supportedReasoningEfforts).toEqual([
		{ reasoningEffort: 'xhigh', description: 'Extra high' }
	]);
	expect(nativeOpusModel.inputModalities).toEqual(['text', 'image']);
	recordExampleCases(meta('nativeOpusModel', 'exposes-the-claude-opus-5-5-catalog-entry'), [
		{
			name: 'catalog entry for claude-opus-5-5',
			input: 'claude-opus-5-5',
			output: {
				id: nativeOpusModel.id,
				displayName: nativeOpusModel.displayName,
				isDefault: nativeOpusModel.isDefault,
				defaultReasoningEffort: nativeOpusModel.defaultReasoningEffort,
				supportedReasoningEfforts: nativeOpusModel.supportedReasoningEfforts,
				inputModalities: nativeOpusModel.inputModalities
			}
		}
	]);
});
