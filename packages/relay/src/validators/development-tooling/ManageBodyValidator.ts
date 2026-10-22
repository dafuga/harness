import { remotePatterns } from '../../../../remote/src/index';
import type {
	RelayManageDevice,
	RelayManageOwner,
	RelayManageRegister
} from '../../../../remote/src/index';
import { isRecord } from '../../utils/development-tooling/isRecord';
import { matchesPattern } from '../../utils/development-tooling/matchesPattern';

const maxText = 200;

/**
 * The bodies of `/manage/*`. Each result holds the known fields and nothing else, so that nothing
 * a caller adds is ever kept.
 */
export class ManageBodyValidator {
	owner(value: unknown): RelayManageOwner | undefined {
		if (!isRecord(value) || !isRecord(value.owner)) return undefined;
		const id = value.owner.id;
		const hostId = value.hostId;
		if (!isText(id) || !matchesPattern(hostId, remotePatterns.hostId)) return undefined;
		return { owner: { id }, hostId };
	}

	register(value: unknown): RelayManageRegister | undefined {
		const call = this.owner(value);
		if (!call || !isRecord(value)) return undefined;
		const { hostKey, credentialHash, name } = value;
		if (!matchesPattern(hostKey, remotePatterns.key)) return undefined;
		if (!matchesPattern(credentialHash, remotePatterns.hash) || !isText(name)) return undefined;
		return { ...call, hostKey, credentialHash, name };
	}

	device(value: unknown): RelayManageDevice | undefined {
		const call = this.owner(value);
		if (!call || !isRecord(value)) return undefined;
		const deviceId = value.deviceId;
		return matchesPattern(deviceId, remotePatterns.deviceId) ? { ...call, deviceId } : undefined;
	}
}

function isText(value: unknown): value is string {
	return typeof value === 'string' && value.length > 0 && value.length <= maxText;
}
