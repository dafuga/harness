import { test } from 'vitest';
import { expect } from '../verificationExpect';
import { recordExampleCases } from '../support/recordExampleCases';
import { ProviderSwitch } from '../../src/models/agents-providers/ProviderSwitch';
import type { PersistenceAdapter } from '../../src/core/development-tooling/sqliteTypes';
import type { ProviderSwitchAttributes, ProviderSwitchCreateInput, ProviderSwitchUpdateInput } from '../../src/models/agents-providers/ProviderSwitch.types';

const session = '7f3a9c21-0b4e-4d2a-8c61-e9f5a3b72d10';
const revision = '8f14e45f-ceea-4e67-9d1a-2b7c5e9f0a31:pending';
const data: ProviderSwitchAttributes['data'] = {
	id: '8f14e45f-ceea-4e67-9d1a-2b7c5e9f0a31',
	sessionId: session,
	target: { provider: 'harness-claude', model: 'claude-opus-5-5', effort: 'xhigh' },
	status: 'pending' as const,
	createdAt: '2026-11-15T09:30:12.418Z',
	reason: 'Desktop control connection unavailable. Requests stay pending; no provider settings change.'
};
const row: ProviderSwitchAttributes = { session, id: revision, data };
const createInput: ProviderSwitchCreateInput = row;
const updateInput: ProviderSwitchUpdateInput = { id: revision, data };

function adapter(overrides: Partial<PersistenceAdapter> = {}): PersistenceAdapter {
	const find = async <T>(): Promise<T | null> => row as T;
	const findBy = async <T>(): Promise<T[]> => [row as T];
	const create = async <T>(): Promise<T> => row as T;
	const update = async <T>(): Promise<T | null> => row as T;
	return {
		find,
		findBy,
		create,
		update,
		delete: async () => true,
		...overrides
	};
}

test('Finds a provider switch by session', async () => {
	const result = await ProviderSwitch.find(adapter(), session);
	expect(result).toEqual(row);
	recordExampleCases({ unitId: 'model.provider-switch', symbol: 'ProviderSwitch.find', state: 'finds-a-provider-switch-by-session', evidence: 'examples-cases', file: 'finds-a-provider-switch-by-session.json' }, [
		{ name: 'returns adapter row unchanged', input: { id: session }, output: result }
	]);
});

test('Finds provider switches by fields', async () => {
	const result = await ProviderSwitch.findBy(adapter(), { session });
	expect(result).toEqual([row]);
	recordExampleCases({ unitId: 'model.provider-switch', symbol: 'ProviderSwitch.findBy', state: 'finds-provider-switches-by-fields', evidence: 'examples-cases', file: 'finds-provider-switches-by-fields.json' }, [
		{ name: 'returns matching rows', input: { session }, output: result }
	]);
});

test('Creates a provider switch record', async () => {
	const result = await ProviderSwitch.create(adapter(), createInput);
	expect(result).toEqual(row);
	recordExampleCases({ unitId: 'model.provider-switch', symbol: 'ProviderSwitch.create', state: 'creates-a-provider-switch-record', evidence: 'examples-cases', file: 'creates-a-provider-switch-record.json' }, [
		{ name: 'returns inserted row', input: createInput, output: result }
	]);
});

test('Updates a provider switch record', async () => {
	const result = await ProviderSwitch.update(adapter(), session, updateInput);
	expect(result).toEqual(row);
	recordExampleCases({ unitId: 'model.provider-switch', symbol: 'ProviderSwitch.update', state: 'updates-a-provider-switch-record', evidence: 'examples-cases', file: 'updates-a-provider-switch-record.json' }, [
		{ name: 'returns updated row', input: { id: session, update: updateInput }, output: result }
	]);
});

test('Deletes a provider switch record', async () => {
	const result = await ProviderSwitch.delete(adapter(), session);
	expect(result).toBe(true);
	recordExampleCases({ unitId: 'model.provider-switch', symbol: 'ProviderSwitch.delete', state: 'deletes-a-provider-switch-record', evidence: 'examples-cases', file: 'deletes-a-provider-switch-record.json' }, [
		{ name: 'reports successful deletion', input: { id: session }, output: result }
	]);
});
