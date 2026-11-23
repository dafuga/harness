import { test } from 'vitest';
import { expect } from '../../../../test/verificationExpect';
import { recordExampleCases } from '../../../../test/support/recordExampleCases';
import {
	within,
	methodsNamed,
	orderedMethods
} from '../../src/components/explorer-ui/entity-contract/methodNames';

test('Matches literal owner declarations', () => {
	const cases = [
		{
			name: 'member suffix matches',
			input: { name: 'Class.method.input', owner: 'Class', whole: false },
			output: true
		},
		{
			name: 'whole owner matches when enabled',
			input: { name: 'Class', owner: 'Class', whole: true },
			output: true
		},
		{
			name: 'whole owner does not match when disabled',
			input: { name: 'Class', owner: 'Class', whole: false },
			output: false
		},
		{
			name: 'similar prefix is rejected',
			input: { name: 'Classy.method', owner: 'Class', whole: true },
			output: false
		}
	];
	expect(cases.map(({ input }) => within(input.name, input.owner, input.whole))).toEqual(
		cases.map(({ output }) => output)
	);
	recordExampleCases(
		{
			unitId: 'reports.function.explorer-ui-entity-contract-method-names',
			symbol: 'within',
			state: 'matches-literal-owner-declarations',
			evidence: 'examples-cases',
			file: 'matches-literal-owner-declarations.json'
		},
		cases
	);
});

test('Extracts declared methods with optional whole members', () => {
	const names = [
		'Class.create.input',
		'Class.read',
		'Class.create.value',
		'Class..input',
		'Other.update.field'
	];
	const included = methodsNamed(names, 'Class', true);
	const excluded = methodsNamed(names, 'Class', false);
	expect(included).toEqual(['create', 'read', 'create']);
	expect(excluded).toEqual(['create', 'create']);
	recordExampleCases(
		{
			unitId: 'reports.function.explorer-ui-entity-contract-method-names',
			symbol: 'methodsNamed',
			state: 'extracts-declared-methods-with-optional-whole-members',
			evidence: 'examples-cases',
			file: 'extracts-declared-methods-with-optional-whole-members.json'
		},
		[
			{
				name: 'whole members included and repeated methods retained',
				input: { names, owner: 'Class', whole: true },
				output: included
			},
			{
				name: 'only members with a suffix included',
				input: { names, owner: 'Class', whole: false },
				output: excluded
			}
		]
	);
});

test('Orders unique methods by contract priority', () => {
	const methods = [
		'delete',
		'read',
		'create',
		'constructor',
		'findBy',
		'custom',
		'create',
		'find',
		'update'
	];
	const output = orderedMethods(methods);
	expect(output).toEqual([
		'create',
		'read',
		'findBy',
		'find',
		'update',
		'delete',
		'constructor',
		'custom'
	]);
	recordExampleCases(
		{
			unitId: 'reports.function.explorer-ui-entity-contract-method-names',
			symbol: 'orderedMethods',
			state: 'orders-unique-methods-by-contract-priority',
			evidence: 'examples-cases',
			file: 'orders-unique-methods-by-contract-priority.json'
		},
		[
			{
				name: 'priority order keeps first occurrence and removes duplicates',
				input: { methods },
				output
			}
		]
	);
});
