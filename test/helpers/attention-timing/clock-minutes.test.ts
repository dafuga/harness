import { expect, test } from 'vitest';
import { clockMinutes } from '../../../src/helpers/attention-timing/clockMinutes';

test('clockMinutes turns HH:MM into minutes after midnight', () => {
	expect(clockMinutes('08:00')).toBe(480);
	expect(clockMinutes('22:30')).toBe(1350);
});

test('clockMinutes rejects anything that is not HH:MM', () => {
	expect(() => clockMinutes('8am')).toThrow('expected HH:MM');
});
