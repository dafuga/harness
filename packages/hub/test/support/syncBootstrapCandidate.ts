import { toBase64Url } from '../../../remote/src/utils/networking-security/remoteBytes';
import { sealedChainEntry } from '../../../remote/src/utils/networking-security/sealedChainEntry';
import {
	sealedDevice,
	sealedDevicePublic
} from '../../../remote/src/utils/networking-security/sealedDevice';
import { sealedGrant } from '../../../remote/src/utils/networking-security/sealedGrant';
import {
	newRecoverySecret,
	sealedRecovery
} from '../../../remote/src/utils/networking-security/sealedRecovery';
import {
	newScopeKeys,
	scopeCommitment
} from '../../../remote/src/utils/networking-security/sealedScopeKeys';

export async function bootstrapCandidate(account: string) {
	const [admin, backup] = await Promise.all([sealedDevice(), sealedDevice({ extractable: true })]);
	const key = newScopeKeys();
	const secret = newRecoverySecret();
	const scope = toBase64Url(key.scopeId);
	const commitment = toBase64Url(await scopeCommitment(key));
	const devices = [
		sealedDevicePublic(admin, 'admin', [scope]),
		sealedDevicePublic(backup, 'recovery', [scope])
	];
	const entry = await sealedChainEntry(admin, {
		seq: 0,
		prev: '',
		at: 1,
		by: admin.deviceId,
		body: { type: 'genesis', account, devices, scopes: [{ scope, epoch: 0, commitment }] }
	});
	const grants = await Promise.all(devices.map((device) => sealedGrant(account, key, device)));
	const recovery = await sealedRecovery(secret, backup);
	const headers = { 'X-Harness-Device': admin.deviceId };
	return { body: { entry, grants, recovery }, headers, secret, commitment, admin, key };
}
