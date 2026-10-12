import { expect, test } from 'vitest';
import { timeLabel } from '../../src/utils/timeLabel';

test('a recorded instant is shown in the reader’s own time', () => {
	const instant = '2026-10-12T09:30:00.000Z';
	const expected = new Date(instant).toLocaleString(undefined, {
		dateStyle: 'medium',
		timeStyle: 'short'
	});
	expect(timeLabel(instant)).toBe(expected);
	expect(timeLabel(instant)).not.toContain('T09');
});

test('words and dates without a time stay as they were recorded', () => {
	expect(timeLabel('Today')).toBe('Today');
	expect(timeLabel('2026-10-11')).toBe('2026-10-11');
	expect(timeLabel('2026-99-99T99:99')).toBe('2026-99-99T99:99');
});
