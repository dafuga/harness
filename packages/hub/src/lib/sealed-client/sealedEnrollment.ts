// @harness-uid u_lq5fngugih
import type {
	ScopeKeys,
	SealedChainPin,
	SealedChainState,
	SealedDeviceKeys
} from '../../../../remote/src/models/networking-security/Sealed.types';
import { sealedChain } from '../../../../remote/src/utils/networking-security/sealedChain';
import { toBase64Url } from '../../../../remote/src/utils/networking-security/remoteBytes';
import { SealedBrowserCache } from './SealedBrowserCache';
import type { SealedEnrollment } from './SealedBrowserCache.types';

export function verifiedEnrollment(account: string, enrollment: SealedEnrollment) {
	return sealedChain(enrollment.entries, { account });
}

function matchesDevice(chain: SealedChainState, device: SealedDeviceKeys): boolean {
	const self = chain.devices[device.deviceId];
	return Boolean(
		self?.active &&
		self.kemPublic === toBase64Url(device.kemPublic) &&
		self.signingPublic === toBase64Url(device.signingPublic) &&
		!device.kem.privateKey.extractable &&
		!device.signing.privateKey.extractable
	);
}

/** Handoff from device approval. The pin comes from the approving device, after code comparison. */
export async function adoptSealedEnrollment(
	account: string,
	enrollment: SealedEnrollment,
	approval: SealedChainPin
): Promise<boolean> {
	if (
		!Number.isSafeInteger(approval.seq) ||
		approval.seq < 0 ||
		!/^[a-f0-9]{64}$/.test(approval.head)
	)
		return false;
	const chain = await sealedChain(enrollment.entries, { account, pin: approval });
	if (!enrollment.device || enrollment.deviceId !== enrollment.device.deviceId) return false;
	if (!matchesDevice(chain, enrollment.device)) return false;
	const cache = await SealedBrowserCache.open(account);
	try {
		return await cache.saveEnrollment(enrollment, []);
	} finally {
		cache.close();
	}
}

export function committedKeys(
	keys: ScopeKeys | undefined,
	commitment: string | undefined
): keys is ScopeKeys {
	return Boolean(
		keys &&
		commitment &&
		toBase64Url(keys.commitment) === commitment &&
		!keys.dataKey.extractable &&
		!keys.indexKey.extractable
	);
}
