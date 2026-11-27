import { afterEach, expect, test, vi } from 'vitest';
import { measureWorkload } from '../../support/measureWorkload';
import { PrivateBrowserGateService } from '../../../src/services/execution-runtimes/PrivateBrowserGateService';

const fixture = () => {
	const revokeInput = vi.fn(async () => undefined);
	const disposeForm = vi.fn<() => Promise<void>>(async () => undefined);
	const verifyResult = vi.fn(async () => true);
	const gate = new PrivateBrowserGateService({ revokeInput, disposeForm, verifyResult });
	return { gate, revokeInput, disposeForm, verifyResult };
};

const admitted = async (gate: PrivateBrowserGateService) => {
	const receipt = await gate.request('paired-device');
	expect(receipt).toEqual({ requestId: expect.any(String) });
	if (!receipt) throw new Error('Private entry was not admitted');
	return receipt.requestId;
};

afterEach(() => vi.useRealTimers());

test('recover denies reads on boot and requires input revocation and confirmed form disposal', async () => {
	const { gate, revokeInput, disposeForm, verifyResult } = fixture();
	const read = vi.fn(async () => 'reviewed result');
	expect(gate.status()).toBe('blocked');
	expect(await gate.read(read)).toBeUndefined();
	expect(await gate.request('paired-device')).toBeUndefined();
	expect(read).not.toHaveBeenCalled();

	revokeInput.mockRejectedValueOnce(new Error('protected fixture'));
	expect(await gate.recover()).toBe(false);
	expect(disposeForm).not.toHaveBeenCalled();
	disposeForm.mockRejectedValueOnce(new Error('protected fixture'));
	expect(await gate.recover()).toBe(false);
	expect(await gate.read(read)).toBeUndefined();

	expect(await gate.recover()).toBe(true);
	expect(disposeForm).toHaveBeenCalledTimes(2);
	expect(verifyResult).not.toHaveBeenCalled();
	expect(await gate.read(read)).toBe('reviewed result');
	read.mockRejectedValueOnce(new Error('protected fixture'));
	expect(await gate.read(read)).toBeUndefined();
});

test('request aborts and drains existing work before private input and drops its output', async () => {
	await measureWorkload(
		'service.execution-runtimes-private-browser-gate',
		'in-flight read through private admission and cancel',
		async () => {
			const { gate } = fixture();
			await gate.recover();
			const started = Promise.withResolvers<AbortSignal>();
			const output = Promise.withResolvers<string>();
			const existing = gate.read(async (signal) => {
				started.resolve(signal);
				return output.promise;
			});
			const signal = await started.promise;
			const starting = gate.request('paired-device');
			expect(signal.aborted).toBe(true);
			expect(gate.status()).toBe('draining');
			expect(await gate.request('paired-device')).toBeUndefined();
			const later = vi.fn(async () => 'other browser content');
			expect(await gate.read(later)).toBeUndefined();
			expect(later).not.toHaveBeenCalled();
			output.resolve('synthetic private canary');
			expect(await existing).toBeUndefined();

			const receipt = await starting;
			expect(receipt).toEqual({ requestId: expect.any(String) });
			expect(gate.status()).toBe('private');
			expect(await gate.cancel(receipt?.requestId ?? '')).toBe(true);
		}
	);
});

test('finish requires the active request and paired device and waits for cleanup and verification', async () => {
	const { gate, revokeInput, disposeForm, verifyResult } = fixture();
	await gate.recover();
	const requestId = await admitted(gate);
	expect(gate.permitsInput(requestId, 'different-device')).toBe(false);
	expect(gate.permitsInput('copied-other-id', 'paired-device')).toBe(false);
	expect(gate.permitsInput(requestId, 'paired-device')).toBe(true);
	expect(await gate.finish(requestId, 'different-device')).toBe(false);
	expect(await gate.finish('copied-other-id', 'paired-device')).toBe(false);

	const closed = Promise.withResolvers<void>();
	disposeForm.mockReturnValueOnce(closed.promise);
	const ending = gate.finish(requestId, 'paired-device');
	expect(gate.status()).toBe('disposing');
	expect(gate.permitsInput(requestId, 'paired-device')).toBe(false);
	expect(await gate.finish(requestId, 'paired-device')).toBe(false);
	expect(await gate.read(async () => 'unsafe')).toBeUndefined();
	expect(verifyResult).not.toHaveBeenCalled();
	expect(revokeInput).toHaveBeenCalledTimes(2);
	closed.resolve();
	expect(await ending).toBe(true);
	expect(gate.status()).toBe('ready');
	expect(await gate.finish(requestId, 'paired-device')).toBe(false);
	expect(await gate.read(async () => 'approved result')).toBe('approved result');
});

test('expiry denies private input, disposes the form and rejects a stale completion', async () => {
	vi.useFakeTimers();
	const { gate, disposeForm, verifyResult } = fixture();
	await gate.recover();
	const requestId = await admitted(gate);
	const closed = Promise.withResolvers<void>();
	disposeForm.mockReturnValueOnce(closed.promise);

	await vi.advanceTimersByTimeAsync(5 * 60_000);
	expect(gate.status()).toBe('disposing');
	expect(gate.permitsInput(requestId, 'paired-device')).toBe(false);
	expect(await gate.finish(requestId, 'paired-device')).toBe(false);
	expect(await gate.read(async () => 'unsafe')).toBeUndefined();
	closed.resolve();
	await vi.advanceTimersByTimeAsync(0);
	expect(gate.status()).toBe('ready');
	expect(verifyResult).not.toHaveBeenCalled();
	expect(await gate.finish(requestId, 'paired-device')).toBe(false);
});

test('cancel disposes the form and keeps the gate closed on cleanup failure', async () => {
	const { gate, disposeForm } = fixture();
	await gate.recover();
	const requestId = await admitted(gate);
	disposeForm.mockRejectedValueOnce(new Error('protected fixture'));
	expect(await gate.cancel(requestId)).toBe(false);
	expect(gate.status()).toBe('blocked');
	expect(gate.permitsInput(requestId, 'paired-device')).toBe(false);
	expect(await gate.read(async () => 'unsafe')).toBeUndefined();
	expect(await gate.recover()).toBe(true);
});

test('finish keeps ordinary reads blocked when the result page cannot be verified', async () => {
	const { gate, verifyResult } = fixture();
	await gate.recover();
	const requestId = await admitted(gate);
	verifyResult.mockResolvedValueOnce(false);
	expect(await gate.finish(requestId, 'paired-device')).toBe(false);
	expect(await gate.read(async () => 'unsafe')).toBeUndefined();
});
