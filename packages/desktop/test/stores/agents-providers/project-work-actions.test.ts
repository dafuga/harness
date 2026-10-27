import { expect, test } from 'vitest';
import { createProjectWorkActionsStore } from '../../../src/lib/stores/agents-providers/projectWorkActions.svelte';

const cases = [
	{
		id: 'initial value is readable',
		initialValue: 'first',
		nextValue: undefined,
		expected: 'first'
	},
	{
		id: 'setting value exposes the new value',
		initialValue: 'first',
		nextValue: 'next',
		expected: 'next'
	}
] as const;

test.each(cases)('$id', ({ initialValue, nextValue, expected }) => {
	const store = createProjectWorkActionsStore(initialValue);
	if (nextValue !== undefined) store.value = nextValue;
	expect(store.value).toBe(expected);
});
