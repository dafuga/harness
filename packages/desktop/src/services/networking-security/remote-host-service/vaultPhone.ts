import { readFileSync } from 'node:fs';
import { isAbsolute } from 'node:path';
import { z } from 'zod';
import { VaultBrokerClientAdapter } from '../../../../../../src/adapters/accounts-access/VaultBrokerClientAdapter';
import type { VaultQueueEntry } from '../../../../../../src/services/accounts-access/VaultBrokerService.types';
import { vaultProof } from '../../../../../../src/validators/accounts-access/VaultWireValidator';
import { RemoteFailure, remotePatterns, vaultMethods } from '../../../../../remote/src/index';
import type { RemoteMethod } from '../../../../../remote/src/index';
import type { VaultPhoneCall, VaultPhoneConfig, VaultPhoneMethod } from './vaultPhone.types';

const configSchema = z.strictObject({
	phone: z.string().regex(remotePatterns.deviceId),
	generation: z.number().int().positive(),
	origin: z.string().refine(syntheticOrigin),
	deviceId: z.string().regex(/^[a-z][a-z0-9-]{0,47}$/u),
	socketPath: z.string().refine(isAbsolute)
});

function syntheticOrigin(text: string): boolean {
	const url = URL.parse(text);
	return url?.protocol === 'https:' && url.hostname.endsWith('.test') && text === url.origin;
}

export function loadVaultPhone(path?: string): VaultPhoneConfig | undefined {
	if (!path || !isAbsolute(path)) return;
	try {
		return configSchema.parse(JSON.parse(readFileSync(path, 'utf8')));
	} catch {
		return undefined;
	}
}

export function isVaultPhoneMethod(method: RemoteMethod): method is VaultPhoneMethod {
	return (vaultMethods as readonly string[]).includes(method);
}

/** Only the configured pairing generation may proxy signed calls for this Vault identity. */
export function vaultPhone(
	config: VaultPhoneConfig | undefined,
	record: { deviceId: string; generation: number }
): VaultPhoneCall | undefined {
	if (config?.phone !== record.deviceId || config.generation !== record.generation) return;
	const client = new VaultBrokerClientAdapter({ socketPath: config.socketPath });
	const identity = { origin: config.origin, deviceId: config.deviceId };
	return async (method, input) => {
		try {
			if (method === 'vaultInfo') return identity;
			if (method === 'vaultChallenge') {
				const challenge = await client.call<object>('/v1/device/challenge', {
					deviceId: config.deviceId
				});
				return { ...challenge, ...identity };
			}
			const { epoch: _epoch, ...body } = input;
			const proof = vaultProof.parse(body);
			if (proof.deviceId !== config.deviceId) throw new RemoteFailure('method-denied');
			if (method === 'vaultDecision') return await client.call('/v1/device/decision', proof);
			const requests = await client.call<VaultQueueEntry[]>('/v1/device/requests', proof);
			return requests.filter(
				(entry) => entry.environment === 'synthetic' && entry.origins.every(syntheticOrigin)
			);
		} catch {
			throw new RemoteFailure('method-denied');
		}
	};
}
