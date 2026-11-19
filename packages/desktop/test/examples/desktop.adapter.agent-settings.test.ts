import { afterEach, test, vi } from 'vitest';
import { expect } from '../../../../test/verificationExpect';
import { recordExampleCases } from '../../../../test/support/recordExampleCases';
import { AgentSettingsAdapter } from '../../src/lib/agents-providers/agent-settings/AgentSettingsAdapter';

const KEY = 'harness.agent-settings.v1';

function memoryStorage(initial: string | null = null) {
	let raw = initial;
	return {
		getItem: vi.fn(() => raw),
		setItem: vi.fn((_key: string, value: string) => {
			raw = value;
		}),
		get raw() {
			return raw;
		}
	};
}

function recordCases(
	symbol: string,
	state: string,
	cases: Parameters<typeof recordExampleCases>[1]
) {
	recordExampleCases(
		{
			unitId: 'desktop.adapter.agent-settings',
			symbol,
			state,
			evidence: 'examples-cases',
			file: `${state}.json`
		},
		cases
	);
}

afterEach(() => {
	vi.unstubAllGlobals();
});

test('Defaults to three without storage and refuses writes', () => {
	vi.stubGlobal('localStorage', undefined);
	const adapter = new AgentSettingsAdapter();
	const read = adapter.read();
	const write = adapter.write(2);
	expect(read).toBe(3);
	expect(write).toBe(false);
	recordCases('read', 'defaults-to-three-without-storage', [
		{ name: 'read with no global storage', input: {}, output: read },
		{ name: 'write 2 with no global storage', input: { designOptions: 2 }, output: write }
	]);
});

test('Persists each allowed count and reads it back from a fresh adapter', () => {
	const storage = memoryStorage();
	const cases: Parameters<typeof recordCases>[2] = [];
	for (const value of [1, 3, 10]) {
		const written = new AgentSettingsAdapter({ storage }).write(value);
		const readBack = new AgentSettingsAdapter({ storage }).read();
		expect(written).toBe(true);
		expect(readBack).toBe(value);
		cases.push({
			name: `write and read ${value}`,
			input: { designOptions: value },
			output: readBack
		});
	}
	expect(storage.raw).toBe(JSON.stringify({ designOptions: 10 }));
	recordCases('write', 'persists-each-allowed-count', cases);
});

test('Refuses unsupported counts without touching storage', () => {
	const storage = memoryStorage(JSON.stringify({ designOptions: 2 }));
	const cases: Parameters<typeof recordCases>[2] = [];
	for (const value of [0, 11, 1.5, NaN]) {
		const written = new AgentSettingsAdapter({ storage }).write(value);
		expect(written).toBe(false);
		cases.push({ name: `write ${value}`, input: { designOptions: value }, output: written });
	}
	expect(storage.setItem).not.toHaveBeenCalled();
	expect(new AgentSettingsAdapter({ storage }).read()).toBe(2);
	recordCases('write', 'refuses-unsupported-counts-without-touching-storage', cases);
});

test('Falls back to three for malformed or out-of-range stored data', () => {
	const samples = [
		'broken',
		'null',
		'[]',
		'{}',
		'{"designOptions":0}',
		'{"designOptions":11}',
		'{"designOptions":"2"}'
	];
	const cases: Parameters<typeof recordCases>[2] = [];
	for (const raw of samples) {
		const read = new AgentSettingsAdapter({ storage: memoryStorage(raw) }).read();
		expect(read).toBe(3);
		cases.push({ name: `read stored ${raw}`, input: { stored: raw }, output: read });
	}
	recordCases('read', 'falls-back-to-three-for-malformed-data', cases);
});

test('Reports storage failures as the default read and a false write', () => {
	const storage = {
		getItem: () => {
			throw new Error('denied');
		},
		setItem: () => {
			throw new Error('quota');
		}
	};
	const adapter = new AgentSettingsAdapter({ storage });
	const read = adapter.read();
	const write = adapter.write(2);
	expect(read).toBe(3);
	expect(write).toBe(false);
	recordCases('read', 'reports-storage-failures', [
		{ name: 'read with denied storage', input: { storage: 'denied' }, output: read },
		{ name: 'write 2 with quota failure', input: { designOptions: 2 }, output: write }
	]);
});
