import { expect } from 'vitest';
import type { TestContractService } from '../../src/services/verification-evidence/TestContractService';
import type { ContractUnit } from './testContractCases.types';

/** New declared input capabilities may add their own row, never unrelated rows. */
export function assertDeclaredInputCapabilities(unit: ContractUnit, service: TestContractService) {
	for (const shape of ['api', 'page', 'component'] as const) assertShape(unit, service, shape);
}

function fixture(unit: ContractUnit, shape: 'api' | 'page' | 'component') {
	const state = shape === 'component' ? 'rest' : 'ready';
	const expected =
		shape === 'api'
			? { kind: 'json' as const, value: { ok: true } }
			: { kind: 'screenshot' as const, file: 'base.png' };
	const item = {
		...unit.testing.cases[0],
		state,
		expected,
		...(shape === 'api'
			? {}
			: { viewports: shape === 'page' ? ['desktop', 'tablet', 'mobile'] : ['desktop'] })
	};
	const before = {
		...unit,
		id: shape === 'api' ? 'endpoint.api-rank' : `${shape}.rank`,
		kind: shape === 'api' ? 'endpoint' : shape,
		testing: { ...unit.testing, shape, states: [state], cases: [item] }
	};
	const row = {
		...item,
		id: 'extra-row',
		input: { extra: true },
		test: { ...item.test, title: 'rank extra' }
	};
	return { item, before, row };
}

function assertShape(
	unit: ContractUnit,
	service: TestContractService,
	shape: 'api' | 'page' | 'component'
) {
	const { item, before, row } = fixture(unit, shape);
	const prop = {
		...before,
		testing: { ...before.testing, props: ['extra'], cases: [item, { ...row, props: ['extra'] }] }
	};
	const error = {
		...before,
		contract: { ...before.contract, errors: [{ name: 'Unavailable', type: 'response' }] },
		testing: { ...before.testing, cases: [item, { ...row, errors: ['Unavailable'] }] }
	};
	expect(service.compare([before], [prop]), `${shape}: declared prop can add its row`).toEqual([]);
	expect(service.compare([before], [error]), `${shape}: declared error can add its row`).toEqual(
		[]
	);
	const unrelated = {
		...prop,
		testing: {
			...prop.testing,
			cases: [...prop.testing.cases, { ...row, id: 'unrelated', input: { other: true } }]
		}
	};
	expect(service.compare([before], [unrelated]).join(' '), `${shape}: unrelated row`).toContain(
		'case identities/count changed'
	);
	const undeclared = {
		...before,
		testing: { ...before.testing, cases: [item, { ...row, props: ['extra'] }] }
	};
	expect(service.compare([before], [undeclared]).join(' '), `${shape}: undeclared prop`).toContain(
		'case identities/count changed'
	);
	const duplicate = {
		...prop,
		testing: {
			...prop.testing,
			cases: [...prop.testing.cases, { ...row, id: 'duplicate', props: ['extra'] }]
		}
	};
	expect(
		service.compare([before], [duplicate]).join(' '),
		`${shape}: duplicate prop row`
	).toContain('duplicate matrix row');
}
