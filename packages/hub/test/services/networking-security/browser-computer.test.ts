import { expect, test, vi } from 'vitest';
import { remoteIdentity, remoteKeys, toBase64Url } from '../../../../remote/src/index';
import { BrowserComputerService } from '../../../src/services/networking-security/BrowserComputerService';
import type { BrowserApi } from '../../../src/utils/browserApi';

const unavailable = Object.assign(new Error('Relay unavailable'), { status: 503 });
const forbidden = Object.assign(new Error('Forbidden'), { status: 403 });

async function startPairing(poll: () => { state: string } | Promise<{ state: string }>) {
	const hostKey = toBase64Url((await remoteKeys()).publicKey);
	const hostId = await remoteIdentity(hostKey);
	const path = `/api/remote/hosts/${hostId}/pairing`;
	const paths: string[] = [];
	let polled!: () => void;
	const firstPoll = new Promise<void>((resolve) => {
		polled = resolve;
	});
	const api = {
		get: async () => ({ hostId, hostKey, origin: 'https://relay.example.invalid' }),
		send: async (_method: string, target: string) => {
			paths.push(target);
			if (target === path) return { state: 'requested' };
			if (target.endsWith('/poll')) {
				polled();
				return poll();
			}
			throw unavailable;
		}
	} as unknown as BrowserApi;
	const service = new BrowserComputerService(api);
	const outcome = service.connect(hostId, vi.fn()).catch((error: unknown) => error);
	await firstPoll;
	return { paths, outcome, service };
}

async function checkPairingPolls() {
	const poll = vi
		.fn()
		.mockImplementationOnce(() => {
			throw unavailable;
		})
		.mockReturnValueOnce({ state: 'requested' })
		.mockReturnValue({ state: 'approved' });
	const recovered = await startPairing(poll);
	await vi.advanceTimersByTimeAsync(700);
	const [request, first] = recovered.paths;
	expect(recovered.paths, 'retry the same pairing poll through approval').toEqual([
		request,
		first,
		first,
		first,
		first.replace(/poll$/, 'exchange')
	]);
	// The exchange itself failed with 503 and must be attempted only once.
	expect(await recovered.outcome).toBe(unavailable);

	const refused = await startPairing(() => {
		throw forbidden;
	});
	expect(await refused.outcome).toBe(forbidden);
	expect(refused.paths).toHaveLength(2);

	const denied = await startPairing(() => ({ state: 'denied' }));
	expect(await denied.outcome).toHaveProperty(
		'message',
		'The computer did not accept the connection.'
	);
	expect(denied.paths).toHaveLength(2);
}

async function checkPairingDeadline() {
	const expired = await startPairing(() => {
		throw unavailable;
	});
	await vi.advanceTimersByTimeAsync(20_000);
	expect(await expired.outcome).toHaveProperty(
		'message',
		'The computer did not accept the connection.'
	);
	const count = expired.paths.length;
	expect(count).toBeGreaterThan(2);
	await vi.advanceTimersByTimeAsync(350);
	expect(expired.paths).toHaveLength(count);

	let approve!: (state: { state: string }) => void;
	const delayed = await startPairing(
		() =>
			new Promise((resolve) => {
				approve = resolve;
			})
	);
	await vi.advanceTimersByTimeAsync(20_000);
	expect(await delayed.outcome).toHaveProperty(
		'message',
		'The computer did not accept the connection.'
	);
	approve({ state: 'approved' });
	await vi.advanceTimersByTimeAsync(350);
	expect(delayed.paths).toHaveLength(2);

	const cancelled = await startPairing(() => {
		throw unavailable;
	});
	cancelled.service.close();
	await vi.advanceTimersByTimeAsync(350);
	expect(await cancelled.outcome).toHaveProperty('name', 'AbortError');
	expect(cancelled.paths).toHaveLength(2);
}

test('computer connection observes host identity, pairing approval, cancellation and expiry', async () => {
	const hostId = 'a'.repeat(40);
	const get = vi.fn(async () => ({ hostId: 'b'.repeat(40) }));
	const send = vi.fn();
	const api = { get, send } as unknown as BrowserApi;
	const rejected = new BrowserComputerService(api);
	await expect(rejected.connect(hostId, vi.fn())).rejects.toThrow('different computer');
	expect(send).not.toHaveBeenCalled();
	const closed = new BrowserComputerService(api);
	closed.close();
	await expect(closed.connect(hostId, vi.fn())).rejects.toThrow();
	expect(send).not.toHaveBeenCalled();

	vi.useFakeTimers();
	try {
		await checkPairingPolls();
		await checkPairingDeadline();
	} finally {
		vi.useRealTimers();
	}
});
