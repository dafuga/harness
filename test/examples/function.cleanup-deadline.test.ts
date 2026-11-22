import { test } from 'vitest';
import { cleanupDeadline } from '../../src/utils/development-tooling/cleanupDeadline';
import type { CleanupDeadline } from '../../src/utils/development-tooling/cleanupDeadline.types';
import { recordExampleCases } from '../support/recordExampleCases';
import { expect } from '../verificationExpect';

test('Deadline returns work or fallback and stops pending waits', async () => {
	const answered = cleanupDeadline(5000) satisfies CleanupDeadline;
	const answer = await answered.within(Promise.resolve('finished'), 'fallback');
	answered.cancel();

	const rejected = cleanupDeadline(5000);
	const rejectionFallback = await rejected.within(Promise.reject(new Error('cleanup failed')), 'fallback');
	rejected.cancel();

	const cancelled = cleanupDeadline(5000);
	cancelled.cancel();
	const cancelledFallback = await cancelled.within(new Promise<string>(() => {}), 'fallback');
	const pendingPause = cleanupDeadline(5000);
	const pause = pendingPause.pause(5000);
	pendingPause.cancel();
	await pause;

	expect({ answer, rejectionFallback, expired: cancelled.expired(), cancelledFallback }).toEqual({ answer: 'finished', rejectionFallback: 'fallback', expired: true, cancelledFallback: 'fallback' });
	recordExampleCases(
		{
			unitId: 'function.cleanup-deadline',
			symbol: 'cleanupDeadline',
			state: 'deadline-returns-work-or-fallback-and-stops-pending-waits',
			evidence: 'examples-cases',
			file: 'deadline-returns-work-or-fallback-and-stops-pending-waits.json'
		},
		[
			{
				name: 'work resolves before the deadline',
				input: { milliseconds: 5000, work: 'resolved', fallback: 'fallback' },
				output: { answer, expiredAfterCleanup: true }
			},
			{
				name: 'work rejects before the deadline',
				input: { milliseconds: 5000, work: 'rejected', fallback: 'fallback' },
				output: { answer: rejectionFallback }
			},
			{
				name: 'cancellation ends pending work immediately',
				input: { milliseconds: 5000, work: 'pending', cancelled: true, fallback: 'fallback' },
				output: { expired: true, answer: cancelledFallback }
			},
			{
				name: 'cancellation ends a pending pause immediately',
				input: { milliseconds: 5000, pauseMilliseconds: 5000, cancelled: true },
				output: { resolved: true }
			}
		]
	);
});
