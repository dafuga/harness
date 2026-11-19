import { afterEach, test, vi } from 'vitest';
import { expect } from '../../../../test/verificationExpect';
import { recordExampleCases } from '../../../../test/support/recordExampleCases';
import { agentSettings, createAgentSettingsStore } from '../../src/lib/stores/agentSettings.svelte';

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
			unitId: 'desktop.store.agent-settings',
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

test('Starts at the default count as saved and unloaded without reading storage', () => {
	const adapter = { read: vi.fn(() => 9), write: vi.fn(() => true) };
	const store = createAgentSettingsStore(adapter);
	const initial = { designOptions: store.designOptions, saved: store.saved };
	const singleton = { designOptions: agentSettings.designOptions, saved: agentSettings.saved };
	expect(initial).toEqual({ designOptions: 3, saved: true });
	expect(singleton).toEqual({ designOptions: 3, saved: true });
	expect(adapter.read).not.toHaveBeenCalled();
	recordCases('createAgentSettingsStore', 'starts-at-the-default-unloaded-state', [
		{ name: 'factory designOptions and saved before load', input: {}, output: initial },
		{ name: 'module agentSettings before load', input: {}, output: singleton },
		{ name: 'adapter read calls before load', input: {}, output: adapter.read.mock.calls.length }
	]);
});

test('load reads the stored count once and ignores later adapter values', () => {
	const values = [9, 4];
	const adapter = { read: vi.fn(() => values.shift() ?? 3), write: vi.fn(() => true) };
	const store = createAgentSettingsStore(adapter);
	store.load();
	const first = store.designOptions;
	store.load();
	store.load();
	expect(first).toBe(9);
	expect(store.designOptions).toBe(9);
	expect(adapter.read).toHaveBeenCalledOnce();
	recordCases('load', 'load-reads-the-stored-count-once', [
		{ name: 'first load keeps the stored count', input: { stored: 9 }, output: first },
		{
			name: 'second and third load keep the first count',
			input: { stored: 4 },
			output: store.designOptions
		},
		{
			name: 'adapter read calls after three loads',
			input: {},
			output: adapter.read.mock.calls.length
		}
	]);
});

test('A supported count updates the shared preference and is written through the adapter', () => {
	const adapter = { read: vi.fn(() => 3), write: vi.fn(() => true) };
	const store = createAgentSettingsStore(adapter);
	store.load();
	const results = [1, 10, 6].map((value) => ({
		input: value,
		returned: store.setDesignOptions(value),
		designOptions: store.designOptions,
		saved: store.saved
	}));
	expect(results).toEqual([
		{ input: 1, returned: true, designOptions: 1, saved: true },
		{ input: 10, returned: true, designOptions: 10, saved: true },
		{ input: 6, returned: true, designOptions: 6, saved: true }
	]);
	expect(adapter.write.mock.calls).toEqual([[1], [10], [6]]);
	recordCases('setDesignOptions', 'valid-counts-update-the-shared-preference', [
		...results.map(({ input, returned, designOptions, saved }) => ({
			name: `set ${input}`,
			input: { designOptions: input },
			output: { returned, designOptions, saved }
		}))
	]);
});

test('Unsupported counts are refused without writing or changing the preference', () => {
	const adapter = { read: vi.fn(() => 2), write: vi.fn(() => true) };
	const store = createAgentSettingsStore(adapter);
	store.load();
	const cases: Parameters<typeof recordCases>[2] = [];
	for (const value of [0, 11, 1.5, -1, NaN]) {
		const returned = store.setDesignOptions(value);
		expect(returned).toBe(false);
		cases.push({
			name: `set ${value}`,
			input: { designOptions: Number.isNaN(value) ? 'NaN' : value },
			output: { returned, designOptions: store.designOptions, saved: store.saved }
		});
	}
	expect(adapter.write).not.toHaveBeenCalled();
	expect(store.designOptions).toBe(2);
	expect(store.saved).toBe(true);
	recordCases('setDesignOptions', 'unsupported-counts-are-refused-without-writing', cases);
});

test('A failed save reports unsaved and a later successful save clears it', () => {
	const writes = [false, true];
	const adapter = { read: vi.fn(() => 3), write: vi.fn(() => writes.shift() ?? true) };
	const store = createAgentSettingsStore(adapter);
	store.load();
	const failed = store.setDesignOptions(7);
	const afterFailure = { designOptions: store.designOptions, saved: store.saved };
	const recovered = store.setDesignOptions(8);
	const afterRecovery = { designOptions: store.designOptions, saved: store.saved };
	expect(failed).toBe(false);
	expect(afterFailure).toEqual({ designOptions: 7, saved: false });
	expect(recovered).toBe(true);
	expect(afterRecovery).toEqual({ designOptions: 8, saved: true });
	expect(adapter.write.mock.calls).toEqual([[7], [8]]);
	recordCases('setDesignOptions', 'failed-saves-are-reported-as-unsaved', [
		{
			name: 'set 7 when the adapter write fails',
			input: { designOptions: 7 },
			output: { returned: failed, ...afterFailure }
		},
		{
			name: 'set 8 when the adapter write succeeds',
			input: { designOptions: 8 },
			output: { returned: recovered, ...afterRecovery }
		}
	]);
});

test('Without an injected adapter the store uses the browser preference', () => {
	const storage = memoryStorage(JSON.stringify({ designOptions: 8 }));
	vi.stubGlobal('localStorage', storage);
	const store = createAgentSettingsStore();
	store.load();
	const loaded = store.designOptions;
	const returned = store.setDesignOptions(4);
	expect(loaded).toBe(8);
	expect(returned).toBe(true);
	expect(storage.setItem).toHaveBeenCalledWith(KEY, JSON.stringify({ designOptions: 4 }));
	expect(storage.raw).toBe(JSON.stringify({ designOptions: 4 }));
	recordCases('createAgentSettingsStore', 'defaults-to-the-browser-preference', [
		{ name: 'load with no adapter reads the stored count', input: { stored: 8 }, output: loaded },
		{
			name: 'set 4 with no adapter writes the browser preference',
			input: { designOptions: 4 },
			output: { returned, designOptions: store.designOptions, saved: store.saved }
		}
	]);
});
