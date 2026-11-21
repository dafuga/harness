import { expect, test } from 'vitest';
import { nextTrackerClock } from '../../../src/utils/projects-sessions/nextTrackerClock';

test('nextTrackerClock advances past a persisted peer clock on a slower host', () => {
	expect(nextTrackerClock('local', 2500, '000000000009000-000021-peer')).toBe(
		'000000000009000-000022-local'
	);
});

test('nextTrackerClock starts a new counter when wall time is newer', () => {
	expect(nextTrackerClock('local', 2500, '000000000001000-000021-peer')).toBe(
		'000000000002500-000000-local'
	);
});

test('nextTrackerClock keeps the six-digit counter after a rollover', () => {
	expect(nextTrackerClock('local', 2500, '000000000009000-999999-peer')).toBe(
		'000000000009001-000000-local'
	);
});
