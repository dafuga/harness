import { DevicePairingService, randomId } from '../../remote/src/index';
import type { MemoryRelay } from './remote-relay-fixture';
import type { AccountPairingTarget } from './remote-account-pairing.types';
export type { AccountPairingTarget } from './remote-account-pairing.types';

/** A phone of the account asks to be linked to the computer; it waits for the approval. */
export async function accountPairing(
	target: AccountPairingTarget,
	deviceName = 'Fixture phone',
	platform: 'test' | 'ios' | 'web' = 'test'
) {
	const pairing = new DevicePairingService({ fetch: target.fetch });
	const pairingId = randomId(16);
	const { origin, hostId, hostKey } = target;
	const pending = await pairing.requestAccount(
		{ origin, hostId, pairingId, code: '', deviceName, platform },
		hostKey,
		async (body) => void (await target.submit(pairingId, body))
	);
	return { pairing, pending, pairingId };
}

/** The target of an account request to a host behind the relay in memory. */
export async function memoryTarget(
	relay: MemoryRelay,
	host: { status(): Promise<{ host: { id: string } | null }> }
): Promise<AccountPairingTarget> {
	const hostId = (await host.status()).host?.id ?? '';
	const { origin, submit, fetch } = relay;
	return { origin, hostId, hostKey: relay.registered.at(-1)?.hostKey ?? '', submit, fetch };
}
