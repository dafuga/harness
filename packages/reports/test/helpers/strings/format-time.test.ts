import { expect, test } from 'vitest';
import { measureWorkload } from '../../../../../test/support/measureWorkload';
import { formatTime, timeLabel } from '../../../src/helpers/strings/formatTime';

test('formatTime formats instants and preserves missing or invalid fallbacks', async () => {
	await measureWorkload('reports.helper.strings-format-time', 'recorded-instants', () => {
		const instant = '2026-11-01T09:30:00Z';
		expect(formatTime(instant)).toBe(
			new Date(instant).toLocaleString(undefined, { dateStyle: 'medium', timeStyle: 'short' })
		);
		expect(formatTime(null)).toBe('Unknown');
		expect(formatTime('invalid')).toBe('invalid');
		expect(formatTime('invalid', 'Unknown')).toBe('Unknown');
		for (const label of ['Today', '2026-11-01', '2026-99-99T99:99'])
			expect(timeLabel(label)).toBe(label);
		expect(timeLabel(instant)).toBe(formatTime(instant));
	});
});
