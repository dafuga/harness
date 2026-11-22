// @harness-uid u_uw3tnnxzru
import { ExpectedCliError } from '../../core/development-tooling/errors';
import { createRequire } from 'node:module';
import { isAbsolute } from 'node:path';
import type { Duplex } from 'node:stream';
import type { VaultPeerAdapterConfig, VaultPeerBinding } from './VaultPeerAdapter.types';

/** Looks up the peer of an accepted Unix connection using the OS socket credential API. */
export class VaultPeerAdapter {
	private readonly binding: VaultPeerBinding;

	constructor(config: VaultPeerAdapterConfig) {
		if (!isAbsolute(config.binary))
			throw new ExpectedCliError('Vault peer binary path must be absolute.');
		this.binding = createRequire(import.meta.url)(config.binary) as VaultPeerBinding;
	}

	uid(socket: Duplex): number | null {
		// Node's accepted libuv socket handle exposes the descriptor. Unknown runtimes fail closed.
		const { _handle } = socket as Duplex & { _handle?: { fd?: number } };
		const fd = _handle?.fd;
		if (typeof fd !== 'number' || !Number.isSafeInteger(fd) || fd < 0) return null;
		return this.binding.peerUid(fd);
	}
}
