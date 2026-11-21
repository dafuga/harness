import { test } from 'vitest';
import type { PersistenceAdapter } from '../../src/core/development-tooling/sqliteTypes';
import { AnalyticsEvent } from '../../src/models/reports-media/AnalyticsEvent';
import type {
	AnalyticsEventAttributes,
	AnalyticsEventUpdateInput
} from '../../src/models/reports-media/AnalyticsEvent.types';
import { recordExampleCases } from '../support/recordExampleCases';
import { expect } from '../verificationExpect';
import type { Row } from './model.analytics-event.test.types';

/**
 * Each public operation of the AnalyticsEvent model runs its real code against an in-memory
 * persistence adapter, which the model is given and does not own. What each call was given and
 * what it returned is recorded as the cases of its state.
 */
const unitId = 'model.analytics-event';
const evidence = 'examples-cases';

const first: AnalyticsEventAttributes = {
	id: 'evt-0001',
	timestamp: '2026-11-15T09:30:00.000Z',
	data: {
		id: 'evt-0001',
		timestamp: '2026-11-15T09:30:00.000Z',
		project: '/project',
		kind: 'command',
		action: 'verify',
		status: 'passed',
		durationMs: 1250
	}
};
const second: AnalyticsEventAttributes = {
	id: 'evt-0002',
	timestamp: '2026-11-15T09:31:00.000Z',
	data: {
		id: 'evt-0002',
		timestamp: '2026-11-15T09:31:00.000Z',
		project: '/project',
		kind: 'step',
		action: 'build',
		status: 'failed',
		exitCode: 2
	}
};
const incoming: AnalyticsEventAttributes = {
	id: 'evt-0003',
	timestamp: '2026-11-15T09:32:00.000Z',
	data: {
		id: 'evt-0003',
		timestamp: '2026-11-15T09:32:00.000Z',
		project: '/project',
		kind: 'evaluation',
		action: 'check',
		status: 'passed',
		checkType: 'response'
	}
};
const patch: AnalyticsEventUpdateInput = {
	data: { ...first.data, status: 'failed', exitCode: 1 }
};

/**
 * An in-memory adapter whose tables hold rows by id. The seeded rows are stored in the events
 * table, and every operation rejects with `failure` when one is given.
 */
function memoryAdapter(
	seeded: AnalyticsEventAttributes[] = [],
	failure?: Error
): PersistenceAdapter {
	const tables = new Map<string, Map<string, Row>>();
	const rowsOf = (table: string): Map<string, Row> => {
		const rows = tables.get(table) ?? new Map<string, Row>();
		tables.set(table, rows);
		return rows;
	};
	for (const row of seeded) rowsOf(AnalyticsEvent.definition.table).set(row.id, { ...row });
	const guard = () => {
		if (failure) throw failure;
	};
	return {
		async find<T>(table: string, id: number | string) {
			guard();
			return (rowsOf(table).get(String(id)) ?? null) as T | null;
		},
		async findBy<T>(table: string, fields: Row) {
			guard();
			const matches = [...rowsOf(table).values()].filter((row) =>
				Object.entries(fields).every(([key, value]) => row[key] === value)
			);
			return matches as T[];
		},
		async create<T>(table: string, input: Row) {
			guard();
			const row = { ...input };
			rowsOf(table).set(String(row.id), row);
			return row as T;
		},
		async update<T>(table: string, id: number | string, input: Row) {
			guard();
			const rows = rowsOf(table);
			const current = rows.get(String(id));
			if (!current) return null;
			const updated = { ...current, ...input };
			rows.set(String(id), updated);
			return updated as T;
		},
		async delete(table: string, id: number | string) {
			guard();
			return rowsOf(table).delete(String(id));
		}
	};
}

test('find called with a stored id returns that events row, and with an unknown id returns null', async () => {
	const adapter = memoryAdapter([first, second]);
	const found = await AnalyticsEvent.find(adapter, first.id);
	const missing = await AnalyticsEvent.find(adapter, 'evt-9999');
	expect(found).toEqual(first);
	expect(missing).toBeNull();
	recordExampleCases(
		{ unitId, symbol: 'AnalyticsEvent.find', state: 'find', evidence, file: 'find.json' },
		[
			{ name: 'stored id', input: { id: first.id }, output: found },
			{ name: 'unknown id', input: { id: 'evt-9999' }, output: missing }
		]
	);
});

test('findBy called with a timestamp returns the events rows that have it, and with no match returns an empty list', async () => {
	const adapter = memoryAdapter([first, second]);
	const matching = { timestamp: second.timestamp };
	const unmatched = { timestamp: '2026-11-15T10:00:00.000Z' };
	const found = await AnalyticsEvent.findBy(adapter, matching);
	const none = await AnalyticsEvent.findBy(adapter, unmatched);
	expect(found).toEqual([second]);
	expect(none).toEqual([]);
	recordExampleCases(
		{ unitId, symbol: 'AnalyticsEvent.findBy', state: 'find-by', evidence, file: 'find-by.json' },
		[
			{ name: 'timestamp of a stored row', input: { fields: matching }, output: found },
			{ name: 'timestamp no row has', input: { fields: unmatched }, output: none }
		]
	);
});

test('create called with a new event returns the row the adapter stored', async () => {
	const adapter = memoryAdapter([first]);
	const created = await AnalyticsEvent.create(adapter, incoming);
	const stored = await AnalyticsEvent.find(adapter, incoming.id);
	expect(created).toEqual(incoming);
	expect(stored).toEqual(incoming);
	recordExampleCases(
		{ unitId, symbol: 'AnalyticsEvent.create', state: 'create', evidence, file: 'create.json' },
		[{ name: 'new event', input: { input: incoming }, output: created }]
	);
});

test('update called with a patch returns the updated row, and with an unknown id returns null', async () => {
	const adapter = memoryAdapter([first]);
	const updated = await AnalyticsEvent.update(adapter, first.id, patch);
	const missing = await AnalyticsEvent.update(adapter, 'evt-9999', patch);
	expect(updated).toEqual({ ...first, ...patch });
	expect(missing).toBeNull();
	recordExampleCases(
		{ unitId, symbol: 'AnalyticsEvent.update', state: 'update', evidence, file: 'update.json' },
		[
			{ name: 'patch to a stored row', input: { id: first.id, input: patch }, output: updated },
			{ name: 'patch to an unknown id', input: { id: 'evt-9999', input: patch }, output: missing }
		]
	);
});

test('delete called for a stored id returns true, and for an id already removed returns false', async () => {
	const adapter = memoryAdapter([first]);
	const removed = await AnalyticsEvent.delete(adapter, first.id);
	const again = await AnalyticsEvent.delete(adapter, first.id);
	expect(removed).toBe(true);
	expect(again).toBe(false);
	recordExampleCases(
		{ unitId, symbol: 'AnalyticsEvent.delete', state: 'delete', evidence, file: 'delete.json' },
		[
			{ name: 'stored id', input: { id: first.id }, output: removed },
			{ name: 'id already removed', input: { id: first.id }, output: again }
		]
	);
});

test('create called while the adapter fails rejects with the same error the adapter raised', async () => {
	const error = new Error('events table is locked');
	const adapter = memoryAdapter([], error);
	await expect(AnalyticsEvent.create(adapter, incoming)).rejects.toBe(error);
	recordExampleCases(
		{
			unitId,
			symbol: 'AnalyticsEvent.create',
			state: 'adapter-rejection',
			evidence,
			file: 'adapter-rejection.json'
		},
		[{ name: 'write while the adapter fails', input: { input: incoming }, error: error.message }]
	);
});
