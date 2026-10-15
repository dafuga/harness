import { test, vi } from 'vitest';
import { expect } from '../../../../test/verificationExpect';
import { AgentSettingsAdapter } from '../../src/adapters/AgentSettingsAdapter';

function fixture(raw: string | null = null) {
	const storage = {
		getItem: vi.fn(() => raw),
		setItem: vi.fn((_key: string, value: string) => {
			raw = value;
		})
	};
	return { storage, adapter: new AgentSettingsAdapter({ storage }) };
}

test('a missing preference defaults to three; each allowed count survives a fresh adapter', () => {
	const { storage, adapter } = fixture();
	expect(adapter.read()).toBe(3);
	for (const value of [1, 2, 3, 10]) {
		expect(adapter.write(value)).toBe(true);
		expect(new AgentSettingsAdapter({ storage }).read()).toBe(value);
	}
});

test('malformed or out-of-range stored preferences fall back to three', () => {
	for (const value of [
		'broken',
		'null',
		'[]',
		'{}',
		'{"designOptions":0}',
		'{"designOptions":11}',
		'{"designOptions":1.5}',
		'{"designOptions":"2"}'
	])
		expect(fixture(value).adapter.read()).toBe(3);
});

test('invalid writes preserve the stored preference', () => {
	const { storage, adapter } = fixture('{"designOptions":2}');
	for (const value of [0, 11, 1.5, NaN, Infinity]) expect(adapter.write(value)).toBe(false);
	expect(storage.setItem).not.toHaveBeenCalled();
	expect(adapter.read()).toBe(2);
});

test('denied reads use the default and failed writes report failure', () => {
	const storage = {
		getItem: () => {
			throw new Error('denied');
		},
		setItem: () => {
			throw new Error('quota');
		}
	};
	const adapter = new AgentSettingsAdapter({ storage });
	expect(adapter.read()).toBe(3);
	expect(adapter.write(2)).toBe(false);
});
