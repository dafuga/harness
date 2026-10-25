import { expect, test } from 'vitest';
import { plainClick } from '../src/utils/harnessShell';

test('only a plain left click is followed inside the application', () => {
	const click = (changes: Partial<MouseEvent> = {}) =>
		({
			button: 0,
			metaKey: false,
			ctrlKey: false,
			shiftKey: false,
			altKey: false,
			...changes
		}) as MouseEvent;
	expect(plainClick(click())).toBe(true);
	for (const changed of [
		{ button: 1 },
		{ metaKey: true },
		{ ctrlKey: true },
		{ shiftKey: true },
		{ altKey: true },
		{ defaultPrevented: true }
	])
		expect([changed, plainClick(click(changed))]).toEqual([changed, false]);
});
