import { afterEach, beforeEach, expect, test, vi } from 'vitest';
import { buildObservation, finishObservation } from '../scripts/ios-build-observation';
beforeEach(() => vi.useFakeTimers());
afterEach(() => vi.useRealTimers());

test('overlapping observations share one bounded probe; timeout and late success stay failed', async () => {
	let resolve!: (value: boolean) => void;
	let signal!: AbortSignal;
	const probe = vi.fn((given: AbortSignal) => {
		signal = given;
		return new Promise<boolean>((done) => {
			resolve = done;
		});
	});
	const read = buildObservation(probe);
	const pending = Array.from({ length: 100 }, () => read.look());
	await vi.advanceTimersByTimeAsync(5000);
	expect(await Promise.all(pending)).toEqual(Array(100).fill(false));
	expect(probe).toHaveBeenCalledTimes(1);
	expect(signal.aborted).toBe(true);
	resolve(true);
	await vi.advanceTimersByTimeAsync(0);
	expect(await read.look()).toBe(false);
	expect(probe).toHaveBeenCalledTimes(1);
});
test('rejected interval observation is consumed and makes finalization fail without calling settle', async () => {
	const read = buildObservation(async () => {
		throw new Error('IO failed');
	});
	expect(await read.look()).toBe(false);
	const settle = vi.fn(async () => null);
	expect(await finishObservation(settle, [read])).toContain('observation failed');
	expect(settle).not.toHaveBeenCalled();
	expect(await read.look()).toBe(false);
});
test('closing wakes a pending caller and prevents further probes', async () => {
	const probe = vi.fn(() => new Promise<boolean>(() => {}));
	const read = buildObservation(probe);
	const pending = read.look();
	await vi.advanceTimersByTimeAsync(0);
	read.close();
	expect(await pending).toBe(false);
	expect(await read.look()).toBe(false);
	expect(probe).toHaveBeenCalledTimes(1);
});
test('settlement rejection returns a failure and closes every observer', async () => {
	const reads = [buildObservation(async () => true), buildObservation(async () => true)];
	const result = await finishObservation(async () => {
		throw new Error('settle failed');
	}, reads);
	expect(result).toContain('settlement failed');
	expect(await Promise.all(reads.map((read) => read.look()))).toEqual([false, false]);
});
test('successful finalization closes observers without changing its result', async () => {
	const reads = [buildObservation(async () => true)];
	expect(await finishObservation(async () => null, reads)).toBeNull();
	expect(await reads[0].look()).toBe(false);
});

test('closing before the first microtask starts no probe after resolution', async () => {
	const probe = vi.fn(async () => true);
	const read = buildObservation(probe);
	const pending = read.look();
	read.close();
	expect(await pending).toBe(false);
	await vi.advanceTimersByTimeAsync(0);
	expect(probe).not.toHaveBeenCalled();
});
