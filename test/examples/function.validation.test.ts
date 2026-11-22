import { test } from 'vitest';
import { expect } from '../verificationExpect';
import { recordExampleCases } from '../support/recordExampleCases';
import { validateProjectName } from '../../src/cli/program/create-project/validation';
import { validateName } from '../../src/core/development-tooling/fields/validateName';
import { validateFieldName } from '../../src/core/development-tooling/fields/validation';
import {
	validateCodeName,
	validateRouteName,
	validateExportName
} from '../../src/core/development-tooling/validation';
import { validateKebabName } from '../../src/workflows/development-tooling/loop-state/validation';

const unitId = 'function.validation';
const evidence = 'examples-cases';

test('Safe name validators trim and reject unsafe paths', () => {
	const cases = [
		{
			name: 'project name is trimmed',
			input: { name: '  Field Notes  ' },
			output: validateProjectName('  Field Notes  ')
		},
		{
			name: 'field name preserves underscores',
			input: { name: 'customer_id' },
			output: validateFieldName('customer_id')
		},
		{
			name: 'code name permits spaces',
			input: { name: 'billing service' },
			output: validateCodeName('billing service')
		},
		{
			name: 'shared validator includes its label in errors',
			input: { name: '../notes', label: 'Project name' },
			error: errorMessage(() => validateName('../notes', 'Project name'))
		}
	];
	expect(cases.map((item) => item.output ?? item.error)).toEqual([
		'Field Notes',
		'customer_id',
		'billing service',
		'Project name cannot include path traversal or path separators.'
	]);
	recordExampleCases(
		{
			unitId,
			symbol: 'validateProjectName',
			state: 'safe-name-validators-trim-and-reject-unsafe-paths',
			evidence,
			file: 'safe-name-validators-trim-and-reject-unsafe-paths.json'
		},
		cases
	);
});

test('Name conversions produce route and export identifiers', () => {
	const cases = [
		{
			name: 'route name becomes kebab case',
			input: { name: 'billing reports' },
			output: validateRouteName('billing reports')
		},
		{
			name: 'export name becomes camel case',
			input: { name: 'billing-report' },
			output: validateExportName('billing-report')
		}
	];
	expect(cases.map((item) => item.output)).toEqual(['billing-reports', 'billingReport']);
	recordExampleCases(
		{
			unitId,
			symbol: 'validateRouteName',
			state: 'name-conversions-produce-route-and-export-identifiers',
			evidence,
			file: 'name-conversions-produce-route-and-export-identifiers.json'
		},
		cases
	);
});

test('Kebab names accept lowercase segments and reject other forms', () => {
	const cases = [
		{
			name: 'trimmed lowercase segments pass',
			input: { name: ' reports-grid2 ', label: 'Unit name' },
			output: validateKebabName(' reports-grid2 ', 'Unit name')
		},
		{
			name: 'uppercase segment fails with label',
			input: { name: 'Reports-grid', label: 'Unit name' },
			error: errorMessage(() => validateKebabName('Reports-grid', 'Unit name'))
		}
	];
	expect(cases.map((item) => item.output ?? item.error)).toEqual([
		'reports-grid2',
		'Unit name must use lowercase kebab-case.'
	]);
	recordExampleCases(
		{
			unitId,
			symbol: 'validateKebabName',
			state: 'kebab-names-accept-lowercase-segments-and-reject-other-forms',
			evidence,
			file: 'kebab-names-accept-lowercase-segments-and-reject-other-forms.json'
		},
		cases
	);
});

function errorMessage(call: () => unknown): string {
	try {
		call();
		return 'no error';
	} catch (error) {
		return error instanceof Error ? error.message : String(error);
	}
}
