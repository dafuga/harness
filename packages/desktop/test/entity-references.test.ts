import { expect } from '../../../test/verificationExpect';
import { test } from 'vitest';
import { entityReferences } from '../src/components/reference-text/entityReferences';

/**
 * How text is read for references: a reference is [[unit:<id>]] with an id of lower-case dotted
 * segments; everything else, an unclosed or malformed reference included, is text as written.
 */
const text = (value: string) => ({ kind: 'text', text: value });
const unit = (id: string) => ({ kind: 'reference', id, text: `[[unit:${id}]]` });

test('text is cut into its words and its references, in order, with nothing lost', () => {
	expect(
		entityReferences('Use [[unit:app.page.orders]] and [[unit:app.shell.order-frame]].')
	).toEqual([
		text('Use '),
		unit('app.page.orders'),
		text(' and '),
		unit('app.shell.order-frame'),
		text('.')
	]);
	expect(entityReferences('[[unit:a.b]][[unit:c.d-e2]]')).toEqual([unit('a.b'), unit('c.d-e2')]);
	expect(entityReferences('')).toEqual([]);
});

test.each([
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
])('%s is text and no reference', (value) => {
	expect(entityReferences(value)).toEqual([text(value)]);
});

test('a reference cut short by the end of a streamed chunk is text until the rest arrives', () => {
	const first = 'Shall I keep [[unit:app.function.form';
	expect(entityReferences(first)).toEqual([text(first)]);
	expect(entityReferences(first + 'at-time]] as it is?')).toEqual([
		text('Shall I keep '),
		unit('app.function.format-time'),
		text(' as it is?')
	]);
});

test('an overlong id is text, so no reference can hold a whole message', () => {
	const id = `app.${'a'.repeat(200)}`;
	expect(entityReferences(`[[unit:${id}]]`)).toEqual([text(`[[unit:${id}]]`)]);
});
