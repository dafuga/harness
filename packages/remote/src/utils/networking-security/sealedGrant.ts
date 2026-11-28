// @harness-uid u_ucn5pcoljj
import { Aes256Gcm, CipherSuite, DhkemP256HkdfSha256, HkdfSha256 } from '@hpke/core';
import type {
	RawScopeKeys,
	ScopeKeys,
	SealedChainState,
	SealedDeviceKeys,
	SealedDevicePublic,
	SealedGrant
} from '../../models/networking-security/Sealed.types';
import { SealedError } from '../../models/networking-security/SealedError';
import { concatBytes, fromBase64Url, remoteBytes, toBase64Url } from './remoteBytes';
import { sealedCanonical } from './sealedChainEntry';
import { sealedScopeKeys } from './sealedScopeKeys';

let cachedSuite: CipherSuite | undefined;

/** Made on first use, so bundles that never wrap a grant can drop HPKE. */
function suite(): CipherSuite {
	cachedSuite ??= new CipherSuite({
		kem: new DhkemP256HkdfSha256(),
		kdf: new HkdfSha256(),
		aead: new Aes256Gcm()
	});
	return cachedSuite;
}

function buffer(bytes: Uint8Array): ArrayBuffer {
	return bytes.slice().buffer;
}

/** HPKE info: label ‖ canonical {account, device, epoch, scope}. Binds a grant to one recipient. */
export function sealedGrantInfo(
	grant: Pick<SealedGrant, 'account' | 'scope' | 'epoch' | 'device'>
): Uint8Array {
	const context = {
		account: grant.account,
		device: grant.device,
		epoch: grant.epoch,
		scope: grant.scope
	};
	return remoteBytes('harness/sealed/v1/grant\0' + sealedCanonical(context));
}

/** Wraps scope key bytes for one device with HPKE base mode, DHKEM(P-256), HKDF-SHA256, AES-256-GCM. */
export async function sealedGrant(
	account: string,
	raw: RawScopeKeys,
	device: Pick<SealedDevicePublic, 'deviceId' | 'kemPublic'>
): Promise<SealedGrant> {
	const context = {
		account,
		scope: toBase64Url(raw.scopeId),
		epoch: raw.epoch,
		device: device.deviceId
	};
	const recipientPublicKey = await suite().kem.deserializePublicKey(
		buffer(fromBase64Url(device.kemPublic))
	);
	const plain = concatBytes(raw.dataKey, raw.indexKey);
	const sealed = await suite().seal(
		{ recipientPublicKey, info: buffer(sealedGrantInfo(context)) },
		buffer(plain)
	);
	plain.fill(0);
	return {
		...context,
		enc: toBase64Url(new Uint8Array(sealed.enc)),
		ct: toBase64Url(new Uint8Array(sealed.ct))
	};
}

function grantedEpoch(grant: SealedGrant, self: SealedDeviceKeys, chain: SealedChainState): string {
	if (grant.account !== chain.account || grant.device !== self.deviceId)
		throw new SealedError('Grant is for another account or device.');
	const device = chain.devices[self.deviceId];
	if (!device?.active || !device.scopes.includes(grant.scope))
		throw new SealedError('Chain does not grant this scope to this device.');
	const commitment = chain.scopes[grant.scope]?.commitments[grant.epoch];
	if (!commitment) throw new SealedError('Chain has no such scope epoch.');
	return commitment;
}

/**
 * Unwraps a grant for this device. The keys must match the commitment the verified chain records
 * for that scope and epoch, so a server cannot slip in keys of its own.
 */
export async function openSealedGrant(
	grant: SealedGrant,
	self: SealedDeviceKeys,
	chain: SealedChainState
): Promise<ScopeKeys> {
	return withGrantKeys(grant, self, chain, async (_raw, keys) => keys);
}

/** Wraps a verified grant for a new device without exporting either installation's private key. */
export async function rewrapSealedGrant(
	grant: SealedGrant,
	self: SealedDeviceKeys,
	chain: SealedChainState,
	recipient: Pick<SealedDevicePublic, 'deviceId' | 'kemPublic'>
): Promise<SealedGrant> {
	return withGrantKeys(grant, self, chain, (raw) => sealedGrant(chain.account, raw, recipient));
}

async function withGrantKeys<T>(
	grant: SealedGrant,
	self: SealedDeviceKeys,
	chain: SealedChainState,
	use: (raw: RawScopeKeys, keys: ScopeKeys) => Promise<T>
): Promise<T> {
	const commitment = grantedEpoch(grant, self, chain);
	const raw = await decryptGrant(grant, self);
	try {
		const keys = await sealedScopeKeys(raw);
		if (toBase64Url(keys.commitment) !== commitment)
			throw new SealedError('Grant keys do not match the chain.');
		return await use(raw, keys);
	} finally {
		raw.dataKey.fill(0);
		raw.indexKey.fill(0);
	}
}

async function decryptGrant(grant: SealedGrant, self: SealedDeviceKeys): Promise<RawScopeKeys> {
	let plain: Uint8Array;
	try {
		const opened = await suite().open(
			{
				recipientKey: self.kem,
				enc: buffer(fromBase64Url(grant.enc)),
				info: buffer(sealedGrantInfo(grant))
			},
			buffer(fromBase64Url(grant.ct))
		);
		plain = new Uint8Array(opened);
	} catch {
		throw new SealedError('Grant failed authentication.');
	}
	try {
		if (plain.length !== 64) throw new SealedError('Grant holds the wrong key size.');
		return {
			scopeId: fromBase64Url(grant.scope),
			epoch: grant.epoch,
			dataKey: plain.slice(0, 32),
			indexKey: plain.slice(32)
		};
	} finally {
		plain.fill(0);
	}
}
