import { expect } from '../../../../test/verificationExpect';
import { test } from 'vitest';
import { referencePrompt } from '../../src/utils/referencePrompt';

/** The lines that ask an agent for references list each grammatical id once, in a bounded list. */
const listed = (prompt: string) =>
	(/^Units you may name: (.*)$/m.exec(prompt)?.[1] ?? '').split(', ');

test('ids are listed once, in order, and an id that is not of the grammar is left out', () => {
	const prompt = referencePrompt(['app.page.orders', 'page:activity', 'a.b', 'app.page.orders']);
	expect(prompt).toContain('Name a unit as [[unit:<id>]] with its registered id');
	expect(listed(prompt)).toEqual(['[[unit:app.page.orders]]', '[[unit:a.b]]']);
});

test('no id is said as none, and a long list keeps its first hundred and twenty', () => {
	expect(listed(referencePrompt([]))).toEqual(['none']);
	const ids = Array.from({ length: 130 }, (_, n) => `app.function.f${n}`);
	const shown = listed(referencePrompt(ids));
	expect(shown).toHaveLength(120);
	expect(shown.at(-1)).toBe('[[unit:app.function.f119]]');
});
