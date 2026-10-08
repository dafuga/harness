import { expect, test } from 'vitest';
import { ProviderSwitchApplyService } from '../../src/services/ProviderSwitchApplyService';
import { ProviderSwitchService } from '../../src/services/ProviderSwitchService';
import { createPickerFixture } from '../support/picker';
import type { SessionObservation } from '../../src/core/pickerTypes';

test('remains pending with a client open or active turn, then verifies provider/model/effort', async () => {
	const { store, catalog, target } = createPickerFixture();
	await new ProviderSwitchService(store, catalog).request('session-a', target);
	let state: SessionObservation = {
		selection: { provider: 'openai', model: 'native', effort: 'high' },
		idle: true,
		clients: 1,
		observedAt: new Date().toISOString()
	};
	const calls: string[] = [];
	const apply = new ProviderSwitchApplyService(store, {
		inspect: async () => state,
		resume: async (id, selection) => {
			calls.push(id);
			state = { ...state, selection };
		}
	});
	await apply.apply('session-a');
	expect(calls).toEqual([]);
	state = { ...state, clients: 0, idle: false };
	await apply.apply('session-a');
	expect(calls).toEqual([]);
	state = { ...state, idle: true };
	await apply.apply('session-a');
	expect(store.get('session-a')?.status).toBe('applied');
	expect(state.selection).toEqual(target);
	await apply.apply('session-a');
	expect(calls).toEqual(['session-a']);
});

test('rolls back a mismatched resume and rejects stale client observations', async () => {
	const { store, catalog, target } = createPickerFixture();
	await new ProviderSwitchService(store, catalog).request('session-a', target);
	const previous = { provider: 'openai' as const, model: 'native', effort: 'high' };
	let state: SessionObservation = {
		selection: previous,
		idle: true,
		clients: 0,
		observedAt: '2000-01-01T00:00:00Z'
	};
	const calls: string[] = [];
	const apply = new ProviderSwitchApplyService(store, {
		inspect: async () => state,
		resume: async (_id, selection) => {
			calls.push(selection.provider);
			state = { ...state, selection: previous };
		}
	});
	await apply.apply('session-a');
	expect(calls).toEqual([]);
	state = { ...state, observedAt: new Date().toISOString() };
	await apply.apply('session-a');
	expect(calls).toEqual(['harness-claude', 'openai']);
	expect(store.get('session-a')?.status).toBe('failed');
	expect(state.selection).toEqual(previous);
});
