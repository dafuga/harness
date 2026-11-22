import { test } from 'vitest';
import { expect } from '../verificationExpect';
import { recordExampleCases } from '../support/recordExampleCases';
import { isScopedRecord, inheritedRecords, citedRecords } from '../../src/services/verification-evidence/evidence-attach-service/attachDependencies';
import type { DependentRecord } from '../../src/services/verification-evidence/evidence-attach-service/attachDependencies.types';

const base = 'e81a3f0c7b52d964a1c08e3f5b27d9e06c4a8f15b3d70e29a6c1f84b5d37e2c0';
const reference = '0d6a9f27c4e1b83d5a0f7c2e91b6d4a8f3e5c07b29d1a6e4f8c3b5d2a7e90f16';
const scopedFailure = 'Scoped to reports.component.evidence-grid: only its scenario states ran, so this record is partial and never a full pass.';

function makeRecord(failures: string[] = [], scoped = false): DependentRecord {
	return {
		id: '4b7e1c9d2a06f83e5d1b7c40a9e2f6837d5c1b0a94e8f2d6c3b7a15e09d4f8a2',
		source: { baseRecord: scoped ? base : base },
		scenarios: [{ referencedRecord: reference }, { referencedRecord: reference }],
		failures
	};
}

test('Detects scoped records by failure prefix', () => {
	const ordinary = { failures: ['snapshot mutated during verification: attachDependencies.ts'] };
	const scoped = { failures: [scopedFailure] };
	const empty = { failures: [] };
	expect(isScopedRecord(ordinary)).toBe(false);
	expect(isScopedRecord(scoped)).toBe(true);
	expect(isScopedRecord(empty)).toBe(false);
	recordExampleCases(
		{ unitId: 'service.verification-evidence-evidence-attach-service-attach-dependencies', symbol: 'isScopedRecord', state: 'detects-scoped-records-by-failure-prefix', evidence: 'examples-cases', file: 'detects-scoped-records-by-failure-prefix.json' },
		[
			{ name: 'ordinary failure is not scoped', input: ordinary, output: false },
			{ name: 'scoped failure prefix is recognized', input: scoped, output: true },
			{ name: 'empty failures are not scoped', input: empty, output: false }
		]
	);
});

test('Collects inherited records in first-seen order', () => {
	const record = makeRecord();
	const scoped = makeRecord([scopedFailure]);
	const output = inheritedRecords(record);
	const scopedOutput = inheritedRecords(scoped);
	expect(output).toEqual([base, reference]);
	expect(scopedOutput).toEqual([]);
	recordExampleCases(
		{ unitId: 'service.verification-evidence-evidence-attach-service-attach-dependencies', symbol: 'inheritedRecords', state: 'collects-inherited-records-in-first-seen-order', evidence: 'examples-cases', file: 'collects-inherited-records-in-first-seen-order.json' },
		[
			{ name: 'deduplicates base and repeated scenario reference', input: record, output },
			{ name: 'scoped record inherits nothing', input: scoped, output: scopedOutput }
		]
	);
});

test('Filters cited records from the ledger', () => {
	const record = makeRecord();
	const scoped = makeRecord([scopedFailure]);
	const ledger = [record.id, 'a3d9e6f1b0c7a5d2e8f4b9c1a6d3e0f7b2c5a8d1e4f9b6c3a0d7e2f5b8c1a4d9', record.id, ''];
	const output = citedRecords(record, ledger);
	const scopedOutput = citedRecords(scoped, ledger);
	expect(output).toEqual(['a3d9e6f1b0c7a5d2e8f4b9c1a6d3e0f7b2c5a8d1e4f9b6c3a0d7e2f5b8c1a4d9', '']);
	expect(scopedOutput).toEqual([]);
	recordExampleCases(
		{ unitId: 'service.verification-evidence-evidence-attach-service-attach-dependencies', symbol: 'citedRecords', state: 'filters-cited-records-from-the-ledger', evidence: 'examples-cases', file: 'filters-cited-records-from-the-ledger.json' },
		[
			{ name: 'drops own id and duplicates but keeps empty id', input: { record, ledger }, output },
			{ name: 'scoped record cites nothing', input: { record: scoped, ledger }, output: scopedOutput }
		]
	);
});
