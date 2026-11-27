import type {
	Pairing,
	PairingDeskOptions,
	Fields,
	PairingCommand
} from './remote-pairing-fixture.types';
import { pkceChallenge, randomCredential } from '../../remote/src/index';
import type { RelayHostFrame } from '../../remote/src/index';
const json = (value: unknown, status = 200) =>
	new Response(JSON.stringify(value), { status, headers: { 'Content-Type': 'application/json' } });

/** The poll and exchange routes of a relay in memory, an account request, and the host commands. */
export class MemoryPairingDesk {
	private readonly pairings = new Map<string, Pairing>();
	constructor(private readonly options: PairingDeskOptions) {}
	fetch = (async (target: RequestInfo | URL, init?: RequestInit) => {
		const parts = new URL(String(target)).pathname.split('/').filter(Boolean),
			pairingId = parts[4] ?? '',
			pairing = this.pairings.get(pairingId),
			{ hostId } = this.options.host();
		if (!pairing || parts[2] !== hostId) return json({ error: 'not-found' }, 404);
		const { state, expiresAt } = pairing;
		const body = JSON.parse(String(init?.body ?? '{}')) as Fields;
		if (init?.method !== 'POST') return json({ error: 'not-found' }, 404);
		if (parts[5] === 'poll') return json({ state, expiresAt });
		if (parts[5] === 'exchange') return this.exchange(pairingId, pairing, String(body.verifier));
		return json({ error: 'not-found' }, 404);
	}) as typeof fetch;
	/** The verified account request of the owner, as the relay hands it to the host. */
	submit(pairingId: string, request: object): void {
		const body = request as Fields;
		const expiresAt = new Date(Date.now() + 300_000).toISOString();
		this.pairings.set(pairingId, {
			state: 'requested',
			expiresAt,
			challenge: String(body.challenge)
		});
		this.options.toHost({
			type: 'pairing-request',
			pairingId,
			account: true,
			expiresAt,
			...body
		} as RelayHostFrame);
	}
	apply(command: PairingCommand): boolean {
		const pairing = this.pairings.get(command.pairingId);
		if (!pairing) return false;
		if (command.type === 'pairing-approve' && command.challenge !== pairing.challenge) return false;
		if (command.type === 'pairing-deny') pairing.state = 'denied';
		else Object.assign(pairing, { state: 'approved', approval: command });
		return true;
	}
	/** One attempt: the pairing is gone before anything is compared. */
	private async exchange(pairingId: string, pairing: Pairing, verifier: string) {
		this.pairings.delete(pairingId);
		const proven = pairing.challenge === (await pkceChallenge(verifier)),
			{ approval } = pairing;
		if (pairing.state !== 'approved' || !approval || !proven)
			return json({ error: 'pairing-invalid' }, 400);
		const credential = randomCredential(),
			{ deviceId, sealed } = approval;
		await this.options.issue(deviceId, credential);
		return json({ deviceId, sealed, credential });
	}
}

export type { PairingDeskOptions } from './remote-pairing-fixture.types';
