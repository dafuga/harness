import { test } from 'vitest';
import { expect } from '../../../../test/verificationExpect';
import { recordExampleCases } from '../../../../test/support/recordExampleCases';
import {
	requirementLabel,
	defaultText,
	nameWords
} from '../../src/components/shared-primitives/contractTableCells';

type Field = Parameters<typeof requirementLabel>[0];

const UNIT_ID = 'reports.function.shared-primitives-contract-table-cells';

function fieldOf(overrides: Partial<Field>): Field {
	return {
		name: 'timeoutMs',
		type: 'number',
		source: 'illustrative',
		examples: [],
		...overrides
	};
}

test('Labels requiredness only when recorded as true or false', () => {
	const required = fieldOf({ required: true });
	const optional = fieldOf({ name: 'theme', type: 'string', required: false });
	const unrecorded = fieldOf({ name: 'label', type: 'string' });

	expect([
		requirementLabel(required),
		requirementLabel(optional),
		requirementLabel(unrecorded)
	]).toEqual(['Required', 'Optional', 'Requiredness not recorded']);
	recordExampleCases(
		{
			unitId: UNIT_ID,
			symbol: 'requirementLabel',
			state: 'labels-requiredness-only-when-recorded-as-true-or-false',
			evidence: 'examples-cases',
			file: 'labels-requiredness-only-when-recorded-as-true-or-false.json'
		},
		[
			{ name: 'timeoutMs is recorded as required', input: required, output: 'Required' },
			{ name: 'theme is recorded as optional', input: optional, output: 'Optional' },
			{ name: 'label has no recorded requiredness', input: unrecorded, output: 'Requiredness not recorded' }
		]
	);
});

test('Shows own defaults as source text and omits absent defaults', () => {
	const textDefault = fieldOf({ name: 'theme', type: 'string', default: 'system' });
	const zeroDefault = fieldOf({ default: 0 });
	const absent = fieldOf({ name: 'description', type: 'string' });
	const undefinedDefault = fieldOf({ name: 'retries', default: undefined });

	expect([
		defaultText(textDefault),
		defaultText(zeroDefault),
		defaultText(absent),
		defaultText(undefinedDefault)
	]).toEqual(['"system"', '0', null, 'undefined']);
	recordExampleCases(
		{
			unitId: UNIT_ID,
			symbol: 'defaultText',
			state: 'shows-own-defaults-as-source-text-and-omits-absent-defaults',
			evidence: 'examples-cases',
			file: 'shows-own-defaults-as-source-text-and-omits-absent-defaults.json'
		},
		[
			{ name: 'theme declares the text default system', input: textDefault, output: '"system"' },
			{ name: 'timeoutMs declares the number default 0', input: zeroDefault, output: '0' },
			{ name: 'description declares no default', input: absent, output: null },
			{ name: 'retries declares the null default', input: { name: 'retries', type: 'number', source: 'illustrative', examples: [], default: null }, output: 'null' }
		]
	);
});

test('Name words split at each dot and keep empty segments', () => {
	const dotted = 'data.displayName';
	const emptySegment = 'a..b';
	const plain = 'timeoutMs';

	expect([nameWords(dotted), nameWords(emptySegment), nameWords(plain)]).toEqual([
		['data', 'displayName'],
		['a', '', 'b'],
		['timeoutMs']
	]);
	recordExampleCases(
		{
			unitId: UNIT_ID,
			symbol: 'nameWords',
			state: 'name-words-split-at-each-dot-and-keep-empty-segments',
			evidence: 'examples-cases',
			file: 'name-words-split-at-each-dot-and-keep-empty-segments.json'
		},
		[
			{ name: 'dotted field name splits into two words', input: dotted, output: ['data', 'displayName'] },
			{ name: 'empty segment between dots is kept', input: emptySegment, output: ['a', '', 'b'] },
			{ name: 'name without dots stays one word', input: plain, output: ['timeoutMs'] }
		]
	);
});
