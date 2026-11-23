import { test } from 'vitest';
import { expect } from '../../../../test/verificationExpect';
import { recordExampleCases } from '../../../../test/support/recordExampleCases';
import { timeAgo } from '../../src/utils/reports-media/timeAgo';

const NOW = Date.parse('2026-11-15T12:00:00.000Z');
const AUTO: Intl.RelativeTimeFormatNumeric = 'auto';
const ALWAYS: Intl.RelativeTimeFormatNumeric = 'always';

test('Formats elapsed ages with the first matching unit', () => {
	const cases = [
		{
			name: 'seven days old, auto numeric',
			input: { value: '2026-11-08T12:00:00.000Z', numeric: AUTO },
			output: 'last week'
		},
		{
			name: 'seven days old, always numeric',
			input: { value: '2026-11-08T12:00:00.000Z', numeric: ALWAYS },
			output: '1 week ago'
		},
		{
			name: 'three hours old, always numeric',
			input: { value: '2026-11-15T09:00:00.000Z', numeric: ALWAYS },
			output: '3 hours ago'
		},
		{
			name: 'thirty days old, auto numeric',
			input: { value: '2026-10-16T12:00:00.000Z', numeric: AUTO },
			output: 'last month'
		},
		{
			name: 'one year old, auto numeric',
			input: { value: '2025-11-15T12:00:00.000Z', numeric: AUTO },
			output: 'last year'
		}
	];
	for (const item of cases) {
		expect(timeAgo(item.input.value, NOW, item.input.numeric)).toEqual(item.output);
	}
	recordExampleCases(
		{
			unitId: 'reports.function.report-display',
			symbol: 'timeAgo',
			state: 'formats-elapsed-ages-with-the-first-matching-unit',
			evidence: 'examples-cases',
			file: 'formats-elapsed-ages-with-the-first-matching-unit.json'
		},
		cases
	);
});

test('Returns just now for future and sub-minute timestamps', () => {
	const cases = [
		{
			name: 'thirty seconds old',
			input: { value: '2026-11-15T11:59:30.000Z' },
			output: 'just now'
		},
		{
			name: 'five minutes in the future',
			input: { value: '2026-11-15T12:05:00.000Z' },
			output: 'just now'
		}
	];
	for (const item of cases) {
		expect(timeAgo(item.input.value, NOW)).toEqual(item.output);
	}
	recordExampleCases(
		{
			unitId: 'reports.function.report-display',
			symbol: 'timeAgo',
			state: 'returns-just-now-for-future-and-sub-minute-timestamps',
			evidence: 'examples-cases',
			file: 'returns-just-now-for-future-and-sub-minute-timestamps.json'
		},
		cases
	);
});

test('Returns an empty string for an unparseable timestamp', () => {
	const cases = [{ name: 'value is not a date', input: { value: 'not-a-date' }, output: '' }];
	expect(timeAgo('not-a-date', NOW)).toBe('');
	recordExampleCases(
		{
			unitId: 'reports.function.report-display',
			symbol: 'timeAgo',
			state: 'returns-an-empty-string-for-an-unparseable-timestamp',
			evidence: 'examples-cases',
			file: 'returns-an-empty-string-for-an-unparseable-timestamp.json'
		},
		cases
	);
});
