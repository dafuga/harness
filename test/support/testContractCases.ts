import type { ContractUnit } from './testContractCases.types';
import { expect } from 'vitest';
import type { TestContractService } from '../../src/services/verification-evidence/TestContractService';
import { assertMatrixAdmissionObjects } from './matrixAdmissionInputs';

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

/** Equal matrix coordinates are one capability, even under a newly declared state. */
export function assertMatrixRows(
	unit: ContractUnit,
	service: TestContractService,
	mode: 'validate' | 'compare'
) {
	for (const shape of ['api', 'page', 'component'] as const)
		assertShapeRows(unit, service, mode, shape);
	assertMatrixAdmissionObjects(unit, service, mode);
}

function assertShapeRows(
	unit: ContractUnit,
	service: TestContractService,
	mode: 'validate' | 'compare',
	shape: 'api' | 'page' | 'component'
) {
	const state = shape === 'component' ? 'rest' : 'ready';
	const expected =
		shape === 'api'
			? { kind: 'json' as const, value: { result: 'error' } }
			: { kind: 'screenshot' as const, file: 'error.png' };
	const original = {
		...unit.testing.cases[0],
		state,
		expected,
		...(shape === 'api' ? {} : { viewports: ['desktop'] })
	};
	const before = {
		...unit,
		testing: { ...unit.testing, shape, states: [state], cases: [original] }
	};
	const first = {
		...original,
		id: 'error.one',
		state: 'error',
		input: { limit: 0, mode: 'invalid' },
		test: { ...original.test, title: 'error one' }
	};
	const second = {
		...first,
		id: 'error.two',
		input: { mode: 'invalid', limit: 0 },
		test: { ...first.test, title: 'error two' }
	};
	const check = (other: typeof second) => {
		const after = {
			...before,
			testing: { ...before.testing, states: [state, 'error'], cases: [original, first, other] }
		};
		return mode === 'compare'
			? service.compare([before], [after])
			: service.validate({ units: [after], scenarios: [], files: new Set([original.test.file]) });
	};
	expect(check(second).join(' ')).toContain('duplicate matrix row');
	if (shape !== 'api')
		expect(check({ ...second, viewports: ['desktop', 'mobile'] }).join(' ')).toContain(
			'duplicate matrix row'
		);
	const distinct =
		shape === 'api'
			? { ...second, input: { ...second.input, limit: 1 } }
			: { ...second, viewports: ['mobile'] };
	expect(check(distinct), `${shape} accepts a distinct boundary or viewport`).toEqual([]);
}
