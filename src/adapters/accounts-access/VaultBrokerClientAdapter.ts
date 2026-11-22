// @harness-uid u_euoiys4fni
import { request } from 'node:http';
import { VaultBrokerError } from '../../validators/accounts-access/VaultBrokerError';
import type { VaultBrokerClientConfig } from './VaultBrokerClientAdapter.types';

/** Posts JSON to the broker's Unix socket; a refusal becomes a VaultBrokerError with its status. */
export class VaultBrokerClientAdapter {
	constructor(private readonly config: VaultBrokerClientConfig) {}

	call<T>(path: string, body: unknown): Promise<T> {
		const text = JSON.stringify(body);
		const options = {
			socketPath: this.config.socketPath,
			path,
			method: 'POST',
			timeout: this.config.timeoutMs ?? 10_000,
			headers: { 'Content-Type': 'application/json', 'Content-Length': Buffer.byteLength(text) }
		};
		return new Promise<T>((resolve, reject) => {
			const outgoing = request(options, (response) => {
				const chunks: Buffer[] = [];
				response.on('data', (chunk: Buffer) => chunks.push(chunk));
				response.on('end', () => {
					try {
						resolve(this.parse<T>(response.statusCode ?? 500, Buffer.concat(chunks)));
					} catch (error) {
						reject(error);
					}
				});
			});
			outgoing.on('timeout', () =>
				outgoing.destroy(new VaultBrokerError(504, 'Broker timed out.'))
			);
			outgoing.on('error', (error) => reject(this.unreachable(error)));
			outgoing.end(text);
		});
	}

	private parse<T>(status: number, bytes: Buffer): T {
		const decoded = JSON.parse(bytes.toString('utf8')) as T & { error?: string };
		if (status >= 200 && status < 300) return decoded;
		throw new VaultBrokerError(status, decoded.error ?? 'Broker refused the call.');
	}

	private unreachable(error: Error): Error {
		if (error instanceof VaultBrokerError) return error;
		return new VaultBrokerError(503, 'The Credential Vault broker is not reachable.');
	}
}

export type { VaultBrokerClientConfig } from './VaultBrokerClientAdapter.types';
