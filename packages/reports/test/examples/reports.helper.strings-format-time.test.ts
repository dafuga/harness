import { test } from 'vitest';
import { expect } from '../../../../test/verificationExpect';
import { recordExampleCases } from '../../../../test/support/recordExampleCases';
import { formatTime, timeLabel, displayTime } from '../../src/helpers/strings/formatTime';

const UNIT_ID = 'reports.helper.strings-format-time';
const instant = '2025-03-04T09:30:00Z';

function compactOf(value: string): string {
	return new Date(value).toLocaleString(undefined, { dateStyle: 'medium', timeStyle: 'short' });
}

function meta(symbol: string, state: string) {
	return { unitId: UNIT_ID, symbol, state, evidence: 'examples-cases', file: `${state}.json` };
}

test('Formats valid instants and keeps fallbacks', () => {
	const compact = formatTime(instant);
	const full = formatTime(instant, 'Unknown', 'full');
	const missing = formatTime(null);
	const invalid = formatTime('not-a-date', 'Not available');
	expect(compact).toBe(compactOf(instant));
	expect(full).toBe(new Date(instant).toLocaleString());
	expect(missing).toBe('Unknown');
	expect(invalid).toBe('Not available');

	recordExampleCases(meta('formatTime', 'formats-valid-instants-and-keeps-fallbacks'), [
		{ name: 'compact valid instant', input: { instant }, output: compact },
		{ name: 'full valid instant', input: { instant, style: 'full' }, output: full },
		{ name: 'missing instant uses Unknown', input: { instant: null }, output: missing },
		{
			name: 'invalid instant uses fallback',
			input: { instant: 'not-a-date', fallback: 'Not available' },
			output: invalid
		}
	]);
});

test('Full style and calendar labels stay as recorded', () => {
	const timestamp = timeLabel(instant);
	const dateOnly = timeLabel('2025-03-04');
	const label = timeLabel('Release window');
	expect(timestamp).toBe(compactOf(instant));
	expect(dateOnly).toBe('2025-03-04');
	expect(label).toBe('Release window');

	recordExampleCases(meta('timeLabel', 'full-style-and-calendar-labels-stay-as-recorded'), [
		{ name: 'timestamp is localized', input: { recorded: instant }, output: timestamp },
		{ name: 'date-only text is unchanged', input: { recorded: '2025-03-04' }, output: dateOnly },
		{ name: 'plain label is unchanged', input: { recorded: 'Release window' }, output: label }
	]);
});

test('Shows Unknown for missing revision instants', () => {
	const valid = displayTime(instant);
	const missing = displayTime(null);
	const invalid = displayTime('not-a-date');
	expect(valid).toBe(compactOf(instant));
	expect(missing).toBe('Unknown');
	expect(invalid).toBe('Unknown');

	recordExampleCases(meta('displayTime', 'shows-unknown-for-missing-revision-instants'), [
		{ name: 'valid instant is compact', input: { instant }, output: valid },
		{ name: 'null instant shows Unknown', input: { instant: null }, output: missing },
		{ name: 'invalid instant shows Unknown', input: { instant: 'not-a-date' }, output: invalid }
	]);
});
