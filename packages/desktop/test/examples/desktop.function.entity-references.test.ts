import { test } from 'vitest';
import { expect } from '../../../../test/verificationExpect';
import { recordExampleCases } from '../../../../test/support/recordExampleCases';
import { entityReferences } from '../../src/components/explorer-ui/reference-text/entityReferences';
import { isUnitId } from '../../src/utils/explorer-ui/entityReferences';

const unitId = 'desktop.function.entity-references';
const text = (value: string) => ({ kind: 'text', text: value });
const unit = (id: string) => ({ kind: 'reference', id, text: `[[unit:${id}]]` });

/** Records one named state of this unit as its function-invocation trace. */
function record(state: string, symbol: string, cases: Parameters<typeof recordExampleCases>[1]) {
	return recordExampleCases(
		{ unitId, symbol, state, evidence: 'examples-cases', file: `${state}.json` },
		cases
	);
}

test('reads complete markers as references and keeps the text around them', () => {
	const mixed = 'Use [[unit:app.page.orders]] and [[unit:app.shell.order-frame]].';
	const adjacent = '[[unit:a.b]][[unit:c.d-e2]]';
	const mixedOutput = [
		text('Use '),
		unit('app.page.orders'),
		text(' and '),
		unit('app.shell.order-frame'),
		text('.')
	];
	expect(entityReferences(mixed)).toEqual(mixedOutput);
	expect(entityReferences(adjacent)).toEqual([unit('a.b'), unit('c.d-e2')]);
	expect(entityReferences('')).toEqual([]);
	record(
		'reads-complete-markers-as-references-and-keeps-the-text-around-them',
		'entityReferences',
		[
			{ name: 'two complete markers between words', input: mixed, output: mixedOutput },
			{
				name: 'two adjacent markers with no text between',
				input: adjacent,
				output: [unit('a.b'), unit('c.d-e2')]
			},
			{ name: 'empty input', input: '', output: [] }
		]
	);
});

test('leaves malformed and unfinished markers as text', () => {
	const malformed = [
		'[[unit:orders]]',
		'[[unit:App.Page.Orders]]',
		'[[unit:app..orders]]',
		'[[unit:app.page.orders.]]',
		'[[unit:https://evil.example/x]]',
		'[[unit:javascript:alert(1)]]',
		'[[unit:../../etc/passwd]]',
		'[[unit: app.page.orders]]',
		'[[unit:app.page.orders]',
		'[[page:app.page.orders]]'
	];
	for (const value of malformed) expect(entityReferences(value)).toEqual([text(value)]);
	const broken = 'See [[unit:half [[unit:app.page.orders]] now';
	const brokenOutput = [text('See [[unit:half '), unit('app.page.orders'), text(' now')];
	expect(entityReferences(broken)).toEqual(brokenOutput);
	record('leaves-malformed-and-unfinished-markers-as-text', 'entityReferences', [
		...malformed.map((value) => ({
			name: `malformed: ${value}`,
			input: value,
			output: [text(value)]
		})),
		{ name: 'broken marker before a complete one', input: broken, output: brokenOutput }
	]);
});

test('accepts only lower-case dotted ids of at most 200 characters', () => {
	const valid = ['a.b', 'app.page.orders', 'desktop.component.message-list', 'c.d-e2'];
	const invalid = ['orders', '1app.page', 'app.2page', 'app_page.x', 'app.page:x', ''];
	const longest = `a.${'b'.repeat(198)}`;
	const overlong = `a.${'b'.repeat(199)}`;
	for (const id of valid) expect(isUnitId(id)).toBe(true);
	for (const id of invalid) expect(isUnitId(id)).toBe(false);
	expect(isUnitId(longest)).toBe(true);
	expect(isUnitId(overlong)).toBe(false);
	record('accepts-only-lower-case-dotted-ids-of-at-most-200-characters', 'isUnitId', [
		...valid.map((input) => ({ name: `valid id ${input}`, input, output: true })),
		...invalid.map((input) => ({ name: `invalid id ${input || '(empty)'}`, input, output: false })),
		{ name: 'id of exactly 200 characters', input: longest, output: true },
		{ name: 'id of 201 characters', input: overlong, output: false }
	]);
});
