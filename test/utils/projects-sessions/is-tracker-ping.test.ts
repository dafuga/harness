import { expect, test } from 'vitest';
import { isTrackerPing } from '../../../src/utils/projects-sessions/isTrackerPing';

test('watchdog and idle-session asks are pings, real questions are not', () => {
	for (const question of [
		'daniel-primary-mbp: Session auto-ary7hr-r569 is idle again after a watchdog check-in. Chief of Staff, please inspect the session.',
		'daniel-primary-mbp: Launch request has had no run on daniel-primary-mbp for at least 60 seconds. Chief of Staff, please inspect the session.',
		'watchdog urgent-launch-queue-stuck: Launch on daniel-primary-mbp has been queued for more than 15 minutes'
	])
		expect(isTrackerPing(question), question).toBe(true);
	for (const question of [
		'Approve?',
		'CoS 20:0x answer received (option A approved). Blocked this run.',
		'Latency target (asked 16 Nov): five-slot lookahead qualifies at ~4.20 s p95',
		'',
		null,
		undefined
	])
		expect(isTrackerPing(question), String(question)).toBe(false);
});
