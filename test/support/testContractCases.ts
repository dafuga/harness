import type { ContractUnit } from './testContractCases.types';
import { expect } from 'vitest';
import { componentManifestSchema } from '../../src/core/unitTypes';
import type { TestContractService } from '../../src/services/verification-evidence/TestContractService';

export function assertExecutedCases(
	registry: Parameters<TestContractService['validate']>[0],
	service: TestContractService
) {
	const revision = 'a'.repeat(40);
	const outcome = {
		file: 'test/rank.test.ts',
		title: 'rank ready',
		revision,
		retry: 0,
		status: 'passed' as 'passed' | 'failed' | 'skipped'
	};
	const run = (outcomes: (typeof outcome)[]) =>
		service.validate({
			...registry,
			...{ execution: { revision, files: [outcome.file], outcomes } }
		});
	expect(run([outcome])).toEqual([]);
	expect(run([]).join(' ')).toContain('missing executed case');
	expect(run([outcome, outcome]).join(' ')).toContain('duplicate executed case');
	expect(run([{ ...outcome, title: 'unregistered bug' }]).join(' ')).toContain(
		'unsupported executed case'
	);
	expect(run([{ ...outcome, revision: 'b'.repeat(40) }]).join(' ')).toContain('wrong revision');
	expect(run([{ ...outcome, status: 'skipped' }]).join(' ')).toContain('did not pass');
	for (const changed of [
		{ ...outcome, retry: -1 },
		{ ...outcome, file: '../escape.test.ts' },
		{ ...outcome, status: 'unknown' as never }
	])
		expect(run([changed]).join(' ')).toContain('invalid executed case');
	expect(
		run([
			{ ...outcome, status: 'failed' },
			{ ...outcome, retry: 1 }
		])
	).toEqual([]);
}

export function assertExpandedCapabilities(
	unit: ContractUnit,
	changed: ContractUnit,
	service: TestContractService
) {
	expect(
		service.compare(
			[unit],
			[
				{
					...changed,
					testing: {
						...changed.testing,
						states: ['ready', 'error'],
						cases: [
							changed.testing.cases[0],
							{
								...changed.testing.cases[1],
								state: 'error',
								test: { ...changed.testing.cases[1].test, title: 'rank error' }
							}
						]
					}
				}
			]
		)
	).toEqual([]);

	const expanded = { ...changed, testing: { ...changed.testing, states: ['ready', 'error'] } };
	expect(
		service.compare([unit], [expanded]).join(' '),
		'a new state cannot excuse another case for the old state'
	).toContain('case identities/count changed');
	const renamed = {
		...expanded,
		testing: {
			...expanded.testing,
			cases: [
				{ ...unit.testing.cases[0], id: 'renamed' },
				{ ...unit.testing.cases[0], id: 'error', state: 'error' }
			]
		}
	};
	expect(
		service.compare([unit], [renamed]).join(' '),
		'an existing supported state retains its case identity'
	).toContain('case identities/count changed');
}

/** Admission is exercised in memory: JSON round trips would erase these accepted properties. */
export function assertCaseAdmissionInputs(unit: ContractUnit, service: TestContractService) {
	let reads = 0;
	const id = unit.testing.cases[0].id;
	const item = { ...unit.testing.cases[0] };
	Object.defineProperty(item, 'id', {
		enumerable: true,
		get: () => {
			reads++;
			return id;
		}
	});
	const cases = [item];
	Object.defineProperty(cases, Symbol.iterator, {
		value: function* () {
			yield item;
		}
	});
	Object.defineProperty(cases, 'constructor', { value: { [Symbol.species]: Array } });
	const raw = { ...unit, testing: { ...unit.testing, cases } };
	expect(componentManifestSchema.safeParse(raw).success).toBe(true);
	expect(service.compare([raw], [raw])).toEqual([]);
	const inflated = {
		...raw,
		testing: { ...raw.testing, cases: [...cases, { ...item, id: 'extra' }] }
	};
	expect(service.compare([raw], [inflated]).join(' ')).toContain('case identities/count changed');
	expect(reads).toBeGreaterThan(0);
}
