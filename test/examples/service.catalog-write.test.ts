import type { Index, Fake, Adapter, Row, Case } from './service.catalog-write.test.types';
import { test } from 'vitest';
import { expect } from '../verificationExpect';
import { recordExampleCases } from '../support/recordExampleCases';
import { CatalogWriteService } from '../../src/services/git-source-history/CatalogWriteService';
import type { CatalogSnapshot } from '../../src/services/git-source-history/CatalogWriteService.types';

const commit = 'b71d4e2a9c0f3857d6e1a4b2c8f09e7d3a5b6c14';
const parent = '4a9e7c10f2d8b35e6a1c7d9f0b24e8c6d3a71f05';
const emptyCommit = 'e05c9b3d7a1f48620c9e5d2b8a7f1036c4d9e8a2';

const mainIndex = {
	schemaVersion: 1,
	refs: { evidence: '6c2e0f9a41d7b58e3f10a2c9d4b6e7f8a9013c52', notes: null },
	branches: [{ name: 'main', head: commit }],
	revisions: [
		{
			commit,
			tree: 'd8f03a6c52b1e9470a7d2c8f5e13b6a94c0e7f21',
			parents: [parent],
			subject: 'Write the catalog projection in one transaction',
			committedAt: '2026-11-14T10:20:47-05:00',
			branches: ['main'],
			coverage: 'verified',
			gaps: [],
			records: [
				{
					id: 'a3f9c1e70b5d28469e1c7a3f58d0b2e46f9a1c3e7d2b5084e6c9a1f3b8d27e05',
					status: 'passed',
					base: parent,
					valid: true,
					problems: []
				}
			]
		}
	],
	units: [{ id: 'service.catalog-write', growth: [] }],
	benchmarks: [],
	profiles: [],
	legacy: [],
	truncated: false,
	problems: []
} as unknown as Index;

const emptyIndex = {
	schemaVersion: 1,
	refs: { evidence: null, notes: null },
	branches: [{ name: 'main', head: emptyCommit }],
	revisions: [
		{
			commit: emptyCommit,
			tree: '9f1a7e3c05d2b84e6c1a9f07d3e28b5a4c60d1e9',
			parents: [],
			subject: 'Initial commit',
			committedAt: '2026-11-12T16:03:44-05:00',
			branches: ['main'],
			coverage: 'unverified',
			gaps: ['no verification record is attached to this commit'],
			records: []
		}
	],
	units: [],
	benchmarks: [],
	profiles: [],
	legacy: [],
	truncated: false,
	problems: []
} as unknown as Index;

const snapshots = [
	{
		commit,
		registry: {
			available: true,
			units: [
				{
					id: 'service.catalog-write',
					kind: 'service',
					status: 'active',
					title: 'CatalogWriteService',
					responsibility:
						'Atomically projects revision snapshots into SQLite, preserving entity metadata and distinct dependency relations.',
					version: '9c1f4e2ab7d03f58',
					dependencies: [
						{ unit: 'adapter.sqlite', via: 'import' },
						{ unit: 'function.stable-json', via: 'import' },
						{ unit: 'adapter.sqlite', via: 'import' }
					],
					scenarios: [],
					owns: { source: [], symbols: [] },
					contract: { inputs: [], outputs: [], errors: [] }
				}
			],
			scenarios: [{ id: 'scenario.replace-once', title: 'Replaces the projection once' }]
		}
	}
] as unknown as CatalogSnapshot[];

function fakeAdapter(failInserts: boolean): Fake {
	const fake: Fake = { adapter: {} as Adapter, executed: [], rows: [], transactions: 0 };
	fake.adapter = {
		transaction: (work: () => void) => {
			fake.transactions += 1;
			work();
		},
		execute: (sql: string) => {
			fake.executed.push(sql);
		},
		insert: (table: string, values: Record<string, unknown>) => {
			if (failInserts) throw new Error('disk full');
			fake.rows.push({ table, values });
		}
	} as unknown as Adapter;
	return fake;
}

function rowsWith(fake: Fake, key: string): Row[] {
	return fake.rows.filter((row) => key in row.values);
}

function summary(fake: Fake) {
	return { transactions: fake.transactions, deletes: fake.executed.length, rows: fake.rows.length };
}

function record(state: string, cases: Case[]): void {
	recordExampleCases(
		{
			unitId: 'service.catalog-write',
			symbol: 'replace',
			state,
			evidence: 'examples-cases',
			file: `${state}.json`
		},
		cases
	);
}

test('Replaces the catalog projection in one transaction', () => {
	const fake = fakeAdapter(false);
	const service = new CatalogWriteService(fake.adapter);
	service.replace(mainIndex, snapshots);

	expect(fake.transactions).toBe(1);
	expect(fake.executed.every((sql) => sql.startsWith('DELETE FROM '))).toBe(true);
	expect(rowsWith(fake, 'registryAvailable').map((row) => row.values.registryAvailable)).toEqual([
		true
	]);
	expect(rowsWith(fake, 'unitId')).toHaveLength(1);
	expect(rowsWith(fake, 'targetId')).toHaveLength(2);
	expect(rowsWith(fake, 'scenarioId')).toHaveLength(1);
	const digests = rowsWith(fake, 'schemaVersion').map((row) => String(row.values.digest));
	expect(digests).toHaveLength(1);
	expect(digests[0]).toMatch(/^[0-9a-f]{64}$/);

	record('replaces-the-catalog-projection-in-one-transaction', [
		{
			name: 'one revision with one unit listing a dependency twice',
			input: { index: mainIndex, snapshots },
			output: {
				transactions: fake.transactions,
				deletes: fake.executed.length,
				rows: fake.rows.length,
				dependencies: rowsWith(fake, 'targetId').map((row) => row.values.targetId)
			}
		}
	]);
});

test('Stores a revision without a registry as unavailable', () => {
	const fake = fakeAdapter(false);
	const service = new CatalogWriteService(fake.adapter);
	service.replace(emptyIndex, []);

	expect(rowsWith(fake, 'registryAvailable').map((row) => row.values.registryAvailable)).toEqual([
		false
	]);
	expect(rowsWith(fake, 'unitId')).toHaveLength(0);
	expect(rowsWith(fake, 'scenarioId')).toHaveLength(0);

	record('stores-a-revision-without-a-registry-as-unavailable', [
		{
			name: 'revision with no matching snapshot',
			input: { index: emptyIndex, snapshots: [] },
			output: summary(fake)
		}
	]);
});

test('Propagates adapter errors out of replace', () => {
	const fake = fakeAdapter(true);
	const service = new CatalogWriteService(fake.adapter);
	let error: unknown;
	try {
		service.replace(mainIndex, snapshots);
	} catch (caught) {
		error = caught;
	}

	expect(error).toBeInstanceOf(Error);
	expect((error as Error).message).toBe('disk full');
	expect(fake.transactions).toBe(1);

	record('propagates-adapter-errors-out-of-replace', [
		{
			name: 'first insert fails inside the transaction',
			input: { index: mainIndex, snapshots },
			error: { name: 'Error', message: 'disk full' }
		}
	]);
});
