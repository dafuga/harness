import type { RemoteHostRegisterInput } from '../../../remote/src/models/RemoteRelay.types';
import { remoteIdentity, remotePatterns } from '../../../remote/src/utils/remoteIdentity';
import { hubFail } from '../utils/hubJson';

type Body = Record<string, unknown>;

const NAME_LENGTH = 80;

function invalid(): never {
	return hubFail('invalid-input');
}

function matching(value: unknown, pattern: RegExp): string {
	return typeof value === 'string' && pattern.test(value) ? value : invalid();
}

function nameOf(value: unknown): string {
	const name = typeof value === 'string' ? value.trim() : '';
	return name.length >= 1 && name.length <= NAME_LENGTH ? name : invalid();
}

/** Null when the text is not an uncompressed P-256 point: then there is no id to compare with. */
async function identityOf(hostKey: string): Promise<string | null> {
	try {
		return await remoteIdentity(hostKey);
	} catch {
		return null;
	}
}

/**
 * Parses what an owner sends about a host into typed values or throws `invalid-input`. Unknown
 * keys are dropped, so nothing in a body can name an owner.
 */
export class RemoteHostValidator {
	/** The id has to be the one its key certifies: a host cannot be registered under another's. */
	async registration(body: Body): Promise<RemoteHostRegisterInput> {
		const hostId = this.hostId(body.hostId);
		const hostKey = matching(body.hostKey, remotePatterns.key);
		const credentialHash = matching(body.credentialHash, remotePatterns.hash);
		const name = nameOf(body.name);
		if ((await identityOf(hostKey)) !== hostId) return invalid();
		return { hostId, hostKey, credentialHash, name };
	}

	hostId(value: unknown): string {
		return matching(value, remotePatterns.hostId);
	}

	deviceId(value: unknown): string {
		return matching(value, remotePatterns.deviceId);
	}
}
