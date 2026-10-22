import { render } from 'svelte/server';
import { expect, test } from 'vitest';
import GameTextField from '../../src/components/game-authoring/GameTextField.svelte';

const drawn = (props: Record<string, unknown>) =>
	render(GameTextField, { props: { value: '', change: () => undefined, ...props } }).body;

test('the field shows the value the game holds, named by its label when it has one', () => {
	const body = drawn({ value: '-2.5', label: 'Condition 1 value', placeholder: 'Value' });
	expect(body).toMatch(/<input[^>]*aria-label="Condition 1 value"/);
	expect(body).toMatch(/value="-2.5"/);
	expect(body).toMatch(/placeholder="Value"/);
	expect(body).not.toMatch(/readonly/);
});

test('a read-only field still shows its value and offers no editing', () => {
	const body = drawn({ value: 'x, y', readonly: true });
	expect(body).toMatch(/value="x, y"/);
	expect(body).toMatch(/readonly/);
	expect(body).not.toMatch(/aria-label/);
});
