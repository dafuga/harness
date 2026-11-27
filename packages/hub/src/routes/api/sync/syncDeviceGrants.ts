import type { SealedChainState } from '../../../../../remote/src/models/networking-security/Sealed.types';
import type { DeviceChange } from './syncDevices.types';
import { fromBase64Url } from './syncBase64';
import { isScopeId } from './syncScope';
import { isDeviceId } from './syncHttp';

function sameSet(left: string[], right: string[]): boolean {
	const expected = new Set(right);
	return (
		left.length === right.length &&
		new Set(left).size === left.length &&
		left.every((item) => expected.has(item))
	);
}

function uncompressedPoint(value: string): boolean {
	const bytes = fromBase64Url(value);
	return bytes?.length === 65 && bytes[0] === 4;
}

function enrollment(change: DeviceChange, before: SealedChainState, admin: string): boolean {
	const body = change.entries[0].body;
	if (body.type !== 'enroll' || change.entries.length !== 1) return false;
	const device = body.device;
	const scopes = before.devices[admin].scopes;
	return (
		Object.keys(body).length === 2 &&
		Object.keys(device).length === 5 &&
		isDeviceId(device.deviceId) &&
		device.role === 'admin' &&
		scopes.length > 0 &&
		uncompressedPoint(device.kemPublic) &&
		uncompressedPoint(device.signingPublic) &&
		sameSet(device.scopes, scopes) &&
		scopes.every((id) => !before.scopes[id].stale)
	);
}

function rotationScope(entry: DeviceChange['entries'][number]): string {
	const body = entry.body;
	if (body.type !== 'rotate' || Object.keys(body).length !== 2) return '';
	const { scope, commitment } = body.commitment;
	return Object.keys(body.commitment).length === 3 &&
		isScopeId(scope) &&
		fromBase64Url(commitment)?.length === 32
		? scope
		: '';
}

function revocation(change: DeviceChange, before: SealedChainState, admin: string): boolean {
	const body = change.entries[0].body;
	if (body.type !== 'revoke' || Object.keys(body).length !== 2 || body.device === admin)
		return false;
	const target = before.devices[body.device];
	if (!target?.active || target.role === 'recovery') return false;
	const stale = Object.keys(before.scopes).filter((scope) => before.scopes[scope].stale);
	const scopes = [...new Set([...target.scopes, ...stale])];
	return sameSet(change.entries.slice(1).map(rotationScope), scopes);
}

function requiredGrants(change: DeviceChange, after: SealedChainState): string[] {
	const body = change.entries[0].body;
	if (body.type === 'enroll') {
		return body.device.scopes.map((scope) =>
			JSON.stringify([scope, after.scopes[scope].epoch, body.device.deviceId])
		);
	}
	const active = Object.values(after.devices).filter((device) => device.active);
	return change.entries.slice(1).flatMap((entry) => {
		if (entry.body.type !== 'rotate') return [];
		const { scope, epoch } = entry.body.commitment;
		return active
			.filter((device) => device.scopes.includes(scope))
			.map((device) => JSON.stringify([scope, epoch, device.deviceId]));
	});
}

/** Check the operation and recipient set after the shared chain verifier checks every signature. */
export function matchesDeviceChange(
	change: DeviceChange,
	before: SealedChainState,
	after: SealedChainState,
	signerId: string
): boolean {
	const signer = before.devices[signerId];
	if (!signer?.active) return false;
	const enrolling = change.entries[0].body.type === 'enroll';
	const valid = enrolling
		? (signer.role === 'admin' || signer.role === 'recovery') &&
			enrollment(change, before, signerId)
		: signer.role === 'admin' && revocation(change, before, signerId);
	return (
		valid &&
		sameSet(
			change.grants.map(({ scope, epoch, device }) => JSON.stringify([scope, epoch, device])),
			requiredGrants(change, after)
		)
	);
}
