import type { HostStorageAdapter } from './HostStorageAdapter';
import { relayConfig } from '../../../configs/networking-security/relayConfig';
import type { PairingRoute } from '../../../models/networking-security/RelayHost.types';
import type { PairingAccessService } from './PairingAccessService';
import type { PairingExchangeService } from './PairingExchangeService';
import type { RateLimitService } from './RateLimitService';
import { readJsonBody } from '../../../utils/development-tooling/readJsonBody';
import { relayError, relayResponse } from '../../../utils/networking-security/relayResponse';
import { PairingBodyValidator } from '../../../validators/networking-security/PairingBodyValidator';

/**
 * The public pairing calls of a host. Nobody is authenticated here, so every call is counted
 * against the limit of the host first. An object without a host answers `not-found` and stores
 * nothing, whatever it is asked.
 */
export class PairingController {
	private readonly validator = new PairingBodyValidator();

	constructor(
		private readonly store: HostStorageAdapter,
		private readonly rate: RateLimitService,
		private readonly access: PairingAccessService,
		private readonly exchanges: PairingExchangeService
	) {}

	async handle(request: Request, route: PairingRoute): Promise<Response> {
		if (!this.store.host()) return relayError(404, 'not-found');
		if (!this.rate.hit('pairing', relayConfig.pairingCalls)) return relayError(429, 'rate-limited');
		if (route.action === 'info') return found(this.access.info(route.pairingId));
		const body = await readJsonBody(request);
		if (route.action === 'exchange') return this.exchange(route.pairingId, body);
		if (!body) return relayError(400, 'invalid-input');
		if (route.action === 'poll') return found(this.access.poll(route.pairingId));
		return this.request(route.pairingId, body);
	}

	private request(pairingId: string, body: Record<string, unknown>): Response {
		const request = this.validator.request(body);
		if (!request) return relayError(400, 'invalid-input');
		const result = this.access.request(pairingId, request);
		if (result === 'not-found') return relayError(404, result);
		return typeof result === 'string' ? relayError(409, result) : relayResponse(202, result);
	}

	/** Every failure of an exchange looks the same, and every attempt uses the pairing up. */
	private async exchange(pairingId: string, body: unknown): Promise<Response> {
		const exchanged = await this.exchanges.exchange(pairingId, this.validator.verifier(body));
		return exchanged ? relayResponse(200, exchanged) : relayError(400, 'pairing-invalid');
	}
}

function found(value: object | undefined): Response {
	return value ? relayResponse(200, value) : relayError(404, 'not-found');
}
