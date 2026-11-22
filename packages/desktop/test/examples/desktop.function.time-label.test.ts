import { test } from 'vitest';
import { expect } from '../../../../test/verificationExpect';
import { recordExampleCases } from '../../../../test/support/recordExampleCases';
import { timeLabel } from '../../src/utils/shared-primitives/timeLabel';

test('formats timestamp prefixes and preserves other labels', () => {
	const timestamp = '2026-11-15T13:45:00Z';
	const dateOnly = '2026-11-15';
	const prose = 'Yesterday at noon';
	const formatted = timeLabel(timestamp);
	const unchangedDate = timeLabel(dateOnly);
	const unchangedProse = timeLabel(prose);
	const expected = new Intl.DateTimeFormat(undefined, {
		dateStyle: 'medium',
		timeStyle: 'short'
	}).format(new Date(timestamp));

	expect(formatted).toBe(expected);
	expect(unchangedDate).toBe(dateOnly);
	expect(unchangedProse).toBe(prose);

	recordExampleCases(
		{
			unitId: 'desktop.function.time-label',
			symbol: 'timeLabel',
			state: 'formats-timestamp-prefixes-and-preserves-other-labels',
			evidence: 'examples-cases',
			file: 'formats-timestamp-prefixes-and-preserves-other-labels.json'
		},
		[
			{ name: 'format an ISO timestamp for the reader locale', input: timestamp, output: formatted },
			{ name: 'preserve a date without the timestamp prefix', input: dateOnly, output: unchangedDate },
			{ name: 'preserve a human readable label', input: prose, output: unchangedProse }
		]
	);
});
