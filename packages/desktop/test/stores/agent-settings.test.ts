import { test, vi } from 'vitest';
import { expect } from '../../../../test/verificationExpect';
import { createAgentSettingsStore } from '../../src/lib/stores/agentSettings.svelte';

test('load reads once and a valid preference updates all consumers of the store', () => {
	const adapter = { read: vi.fn(() => 2), write: vi.fn(() => true) };
	const store = createAgentSettingsStore(adapter);
	expect(store.designOptions).toBe(3);
	store.load();
	store.load();
	expect(store.designOptions).toBe(2);
	expect(adapter.read).toHaveBeenCalledOnce();
	expect(store.setDesignOptions(10)).toBe(true);
	expect(store.designOptions).toBe(10);
	expect(adapter.write).toHaveBeenCalledWith(10);
	expect(store.saved).toBe(true);
});

test('invalid preferences are refused and persistence failure stays visible', () => {
	const adapter = { read: () => 3, write: vi.fn(() => false) };
	const store = createAgentSettingsStore(adapter);
	store.load();
	expect(store.setDesignOptions(11)).toBe(false);
	expect(store.designOptions).toBe(3);
	expect(adapter.write).not.toHaveBeenCalled();
	expect(store.setDesignOptions(2)).toBe(false);
	expect(store.designOptions).toBe(2);
	expect(store.saved).toBe(false);
});
