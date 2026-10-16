import { expect } from '../../../../test/verificationExpect';
import { test } from 'vitest';
import { entityReferences, isUnitId } from '../../src/utils/entityReferences';

/** The grammar of a reference id, and markers that are broken around a whole one. */
test('an id is lower-case dotted segments of at most 200 characters', () => {
	for (const id of ['a.b', 'app.page.orders', 'desktop.component.message-list', 'c.d-e2'])
		expect(isUnitId(id)).toBe(true);
	for (const id of ['orders', '1app.page', 'app.2page', 'app_page.x', 'app.page:x', ''])
		expect(isUnitId(id)).toBe(false);
	expect(isUnitId(`a.${'b'.repeat(198)}`)).toBe(true);
	expect(isUnitId(`a.${'b'.repeat(199)}`)).toBe(false);
});

test('a broken marker stays text and the whole reference after it is still read', () => {
	const value = 'See [[unit:half [[unit:app.page.orders]] now';
	expect(entityReferences(value)).toEqual([
		{ kind: 'text', text: 'See [[unit:half ' },
		{ kind: 'reference', id: 'app.page.orders', text: '[[unit:app.page.orders]]' },
		{ kind: 'text', text: ' now' }
	]);
});

test('lines, markup and malformed markers around references join back into the text', () => {
	const value = '<b>\n[[unit:App.X]] [[unit:a.b]]\n[[unit:a.b]x]] &amp;';
	const parts = entityReferences(value);
	expect(parts.map((part) => part.text).join('')).toBe(value);
	expect(parts.filter((part) => part.kind === 'reference')).toHaveLength(1);
});
