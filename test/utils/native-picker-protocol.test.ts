import { expect, test } from 'vitest';
import { pickerProvider } from '../../src/utils/nativePickerProtocol';

test('native picker retains the OpenAI provider by default', () => {
	expect(pickerProvider('gpt-6.1-sol')).toBe('openai');
});
