import { pkceChallenge, randomCredential } from '../../remote/src/index';
import type { RelayHostCommand, RelayHostFrame } from '../../remote/src/index';

interface Pairing {
	state: string;
	expiresAt: string;
	challenge?: string;
	approval?: { deviceId: string; sealed: string };
}
type Fields = Record<string, unknown>;
type PairingCommand = Exclude<
	Extract<RelayHostCommand, { ref: string }>,
	{ type: 'device-revoke' }
>;
export interface PairingDeskOptions {
	host: () => { hostId: string; hostKey: string };
	toHost: (frame: RelayHostFrame) => void;
	/** A device exchanged its approval: the relay keeps a hash of the credential it was given. */
	issue: (deviceId: string, credential: string) => Promise<void>;
}
const json = (value: unknown, status = 200) =>
	new Response(JSON.stringify(value), { status, headers: { 'Content-Type': 'application/json' } });

/** The public pairing routes of a relay in memory, and the host commands that drive them. */
export class MemoryPairingDesk {
	private readonly pairings = new Map<string, Pairing>();
	constructor(private readonly options: PairingDeskOptions) {}
	fetch = (async (target: RequestInfo | URL, init?: RequestInit) => {
		const parts = new URL(String(target)).pathname.split('/').filter(Boolean),
			pairingId = parts[4] ?? '',
			pairing = this.pairings.get(pairingId),
			{ hostId, hostKey } = this.options.host();
		if (!pairing || parts[2] !== hostId) return json({ error: 'not-found' }, 404);
		const { state, expiresAt } = pairing;
		if (!init?.method || init.method === 'GET')
			return json({ hostId, pairingId, hostKey, state, expiresAt });
		const body = JSON.parse(String(init.body ?? '{}')) as Fields;
		if (parts[5] === 'poll') return json({ state, expiresAt });
		if (parts[5] === 'exchange') return this.exchange(pairingId, pairing, String(body.verifier));
		Object.assign(pairing, { state: 'requested', challenge: body.challenge });
		this.options.toHost({ type: 'pairing-request', pairingId, ...body } as RelayHostFrame);
		return json({ state: 'requested', expiresAt }, 202);
	}) as typeof fetch;
	apply(command: PairingCommand): boolean {
		if (command.type === 'pairing-open') {
			this.pairings.set(command.pairingId, { state: 'open', expiresAt: command.expiresAt });
			return true;
		}
		const pairing = this.pairings.get(command.pairingId);
		if (!pairing) return false;
		if (command.type === 'pairing-close') return this.pairings.delete(command.pairingId);
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
