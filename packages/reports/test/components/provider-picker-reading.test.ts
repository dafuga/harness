import { expect, test } from 'vitest';
import {
	failureText,
	isSnapshot,
	readSessions,
	selectionLabel
} from '../../src/components/agents-providers/provider-picker/providerPickerReading';

test('a response is a snapshot only when it names the default provider', () => {
	expect(isSnapshot({ defaultProvider: 'openai' })).toBe(true);
	expect(isSnapshot({ sessions: [] })).toBe(false);
	expect(isSnapshot(null)).toBe(false);
});

test('queued sessions must arrive as a list', () => {
	expect(readSessions({ sessions: [{ id: 'a' }] })).toEqual([{ id: 'a' }]);
	expect(readSessions({ sessions: 'a' })).toBeNull();
	expect(readSessions(null)).toBeNull();
});

test('a selection shows its catalog label or falls back to the model id', () => {
	const models = [{ provider: 'openai', model: 'gpt-a', label: 'GPT A' }] as never;
	expect(selectionLabel(models, { provider: 'openai', model: 'gpt-a' } as never)).toBe('GPT A');
	expect(selectionLabel(models, { provider: 'openai', model: 'gpt-b' } as never)).toBe('gpt-b');
});

test('failure text keeps an error message and otherwise the fallback', () => {
	expect(failureText(new Error('down'), 'x')).toBe('down');
	expect(failureText('down', 'x')).toBe('x');
});
