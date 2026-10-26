import type { ContractUnit } from './testContractCases.types';
import { expect } from 'vitest';
import type { TestContractService } from '../../src/services/verification-evidence/TestContractService';
import { assertMatrixAdmissionObjects } from './matrixAdmissionInputs';

/** Each required scenario check names the active cases it actually intends to execute. */
export function assertScenarioReferences(
	registry: Parameters<TestContractService['validate']>[0],
	service: TestContractService
) {
	const unit = registry.units[0];
	const scenario: (typeof registry.scenarios)[number] = {
		schemaVersion: 1,
		id: 'rank',
		title: 'Rank response',
		kind: 'headless',
		units: [unit.id],
		states: [{ id: 'ready', title: 'Ready', coverage: 'required' }],
		viewports: [],
		tests: [{ id: 'response', kind: 'unit', runner: 'vitest', target: 'test/rank.test.ts' }],
		evidence: []
	};
	const validate = (entry: typeof scenario, required = true, units = registry.units) =>
		service.validate({ ...registry, units, scenarios: [entry], required });
	for (const cases of [undefined, []]) {
		const entry = { ...scenario, tests: [{ ...scenario.tests[0], cases }] };
		expect(validate(entry).join(' ')).toContain('requires declared cases');
		expect(validate(entry, false)).toEqual([]);
	}
	const reference = { unit: unit.id, case: 'ready' };
	const entry = { ...scenario, tests: [{ ...scenario.tests[0], cases: [reference] }] };
	expect(validate(entry)).toEqual([]);
	expect(
		validate({ ...entry, tests: [{ ...entry.tests[0], cases: [reference, reference] }] }).join(' ')
	).toContain('duplicate case reference');
	expect(
		validate({
			...entry,
			tests: [{ ...entry.tests[0], cases: [{ ...reference, case: 'absent' }] }]
		}).join(' ')
	).toContain('orphaned case');
	expect(validate(entry, true, [{ ...unit, status: 'retired' }]).join(' ')).toContain(
		'orphaned case'
	);
	for (const coverage of ['missing', 'inapplicable'] as const)
		expect(validate({ ...entry, states: [{ ...entry.states[0], coverage }] }).join(' ')).toContain(
			'requires a covered state'
		);
	expect(
		validate({ ...entry, states: [{ ...entry.states[0], units: ['endpoint.other'] }] }).join(' ')
	).toContain('state does not cover unit');
}

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
	const expected = matrixExpected(shape);
	const viewports = shape === 'page' ? ['desktop', 'tablet', 'mobile'] : ['desktop'];
	const original = {
		...unit.testing.cases[0],
		state,
		expected,
		...(shape === 'api' ? {} : { viewports })
	};
	const before = {
		...unit,
		id: shape === 'api' ? 'endpoint.api-rank' : `${shape}.rank`,
		kind: shape === 'api' ? 'endpoint' : shape,
		testing: { ...unit.testing, shape, states: [state], cases: [original] }
	};
	const first = {
		...original,
		id: 'error.one',
		state: 'error',
		...(shape === 'page' ? { viewports: ['desktop', 'tablet'] } : {}),
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

function matrixExpected(shape: 'api' | 'page' | 'component') {
	return shape === 'api'
		? { kind: 'json' as const, value: { result: 'error' } }
		: { kind: 'screenshot' as const, file: 'error.png' };
}
