import { expect, test } from 'vitest';
import { cleanupDeadline } from '../../src/utils/cleanupDeadline';

test('work that answers in time is passed on; late or failing work gives the fallback', async () => {
	const deadline = cleanupDeadline(200);
	expect(deadline.expired()).toBe(false);
	expect(await deadline.within(Promise.resolve('done'), 'late')).toBe('done');
	expect(await deadline.within(Promise.reject(new Error('failed')), 'late')).toBe('late');
	expect(await deadline.within(new Promise<string>(() => {}), 'late')).toBe('late');
	expect([deadline.expired(), deadline.signal.aborted]).toEqual([true, true]);
	expect(await deadline.within(Promise.resolve('done'), 'late')).toBe('late');
});

test('a cancelled deadline is over at once, and a pause under it ends with it', async () => {
	const deadline = cleanupDeadline(60_000);
	const began = Date.now();
	const paused = deadline.pause(30_000);
	deadline.cancel();
	await paused;
	expect(Date.now() - began).toBeLessThan(1000);
	expect([deadline.expired(), deadline.signal.aborted]).toEqual([true, true]);
});

test('a pause under a deadline is no longer than what is left of it', async () => {
	const deadline = cleanupDeadline(150);
	const began = Date.now();
	await deadline.pause(30_000);
	expect(Date.now() - began).toBeLessThan(1500);
});
