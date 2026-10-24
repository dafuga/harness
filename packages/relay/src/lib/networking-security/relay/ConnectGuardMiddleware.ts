import { relayConfig } from '../../../configs/networking-security/relayConfig';
import type { RelayEnv } from '../../../models/networking-security/RelayHost.types';
import { connectClaims } from '../../../utils/development-tooling/connectClaims';
import { relayError } from '../../../utils/networking-security/relayResponse';

/** What the public Worker refuses by itself, before any host object is asked. */
export class ConnectGuardMiddleware {
	constructor(private readonly env: Partial<RelayEnv>) {}

	/** Production and staging serve nothing over plain HTTP: a credential travels over TLS only. */
	transport(request: Request): Response | undefined {
		const environments: readonly string[] = relayConfig.tlsEnvironments;
		if (!environments.includes(this.env.HARNESS_ENVIRONMENT ?? '')) return undefined;
		if (new URL(request.url).protocol === 'https:') return undefined;
		return relayError(400, 'tls-required');
	}

	/**
	 * A connect request has to be an upgrade, has to come from a native client or an allow-listed
	 * origin, and has to carry well-formed claims in its headers.
	 */
	handle(request: Request): Response | undefined {
		if (request.headers.get('Upgrade')?.toLowerCase() !== 'websocket') {
			return relayError(426, 'upgrade-required', { Upgrade: 'websocket' });
		}
		const origin = request.headers.get('Origin');
		if (origin !== null && !this.origins().includes(origin)) {
			return relayError(403, 'origin-denied');
		}
		if (!connectClaims(request.headers)) return relayError(401, 'credential-invalid');
		return undefined;
	}

	private origins(): string[] {
		return (this.env.HARNESS_RELAY_ALLOWED_ORIGINS ?? '').split(/[\s,]+/).filter(Boolean);
	}
}
