import { render } from 'svelte/server';
import { expect, test } from 'vitest';
import ActivityListStates from '../../tests/e2e/support/shell/ActivityListStates.svelte';

test('the component state fixture renders real list content, including caller-supplied errors', () => {
	const body = (state: string) => render(ActivityListStates, { props: { state } }).body;
	expect(body('collapsed')).toContain('Show all 7 activities');
	expect(body('short')).not.toContain('Show all');
	expect(body('empty')).toContain('No recent activity.');
	expect(body('ordered')).toContain('<ol');
	expect(body('error')).toContain('role="alert"');
	expect(body('error')).toContain('does not fetch data or create errors');
});
