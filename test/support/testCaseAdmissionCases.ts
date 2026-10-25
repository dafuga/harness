import { expect } from 'vitest';
import type { ComponentManifest } from '../../src/core/unitTypes';
import type { ContractCase } from '../../src/services/verification-evidence/TestContractService';
import type { TestCaseValidator } from '../../src/validators/verification-evidence/TestCaseValidator';
import type { TestContractService } from '../../src/services/verification-evidence/TestContractService';
import type { ContractUnit } from './testContractCases.types';

/** Invalid declarations stay in the validator's existing method/state case. */
export function assertDeclaredCases(
	validator: TestCaseValidator,
	unit: ComponentManifest,
	helper: ComponentManifest,
	item: ContractCase
) {
	const base = { version: 1, shape: 'service', states: ['rest'], cases: [item] };
	for (const invalid of [
		{ ...base, states: undefined },
		{ ...base, states: ['rest', 'rest'] },
		{ ...base, cases: [{ ...item, subject: 'Runner' }] },
		{ ...base, cases: [{ ...item, expected: { kind: 'json', value: {} } }] },
		{ ...base, cases: [{ ...item, expected: { kind: 'screenshot', file: 'rank.png' } }] }
	])
		expect(
			validator.validate(unit, invalid).valid,
			'admit only declared method/state results'
		).toBe(false);
	expect(
		validator.validate(helper, {
			...base,
			cases: [{ ...item, subject: 'rank' }]
		}).valid,
		'a function cannot use a class matrix'
	).toBe(false);
}

/** A prop or error name cannot create arbitrary additional rows of an existing state. */
export function assertPropCaseInflation(unit: ContractUnit, service: TestContractService) {
	const item = unit.testing.cases[0];
	const added = { ...item, id: 'extra-row' };
	const prop = {
		...unit,
		testing: { ...unit.testing, props: ['extra'], cases: [item, { ...added, props: ['extra'] }] }
	};
	const error = {
		...unit,
		contract: { ...unit.contract, errors: [{ name: 'Unavailable', type: 'response' }] },
		testing: { ...unit.testing, cases: [item, { ...added, errors: ['Unavailable'] }] }
	};
	for (const after of [prop, error])
		expect(
			service.compare([unit], [after]).join(' '),
			'new inputs cannot inflate an existing row'
		).toContain('case identities/count changed');
}
