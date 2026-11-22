import { test } from 'vitest';
import { expect } from '../verificationExpect';
import { recordExampleCases } from '../support/recordExampleCases';
import { pickerResource } from '../../src/services/agents-providers/CodexPickerMcpService';

test('Exposes the model picker resource URI', () => {
	expect(pickerResource).toBe('ui://harness-claude/model-picker');
	recordExampleCases(
		{
			unitId: 'service.codex-picker-mcp',
			symbol: 'pickerResource',
			state: 'exposes-the-model-picker-resource-uri',
			evidence: 'examples-cases',
			file: 'exposes-the-model-picker-resource-uri.json'
		},
		[
			{
				name: 'the picker resource has its stable UI URI',
				input: {},
				output: { uri: pickerResource }
			}
		]
	);
});
