import { expect, test } from 'vitest';
import * as remote from '../src/index';

const names = [
	'REMOTE_PROTOCOL',
	'remoteLimits',
	'remoteMethods',
	'remoteErrorMessages',
	'relayCloseCodes',
	'relayHeaders',
	'RemoteFailure',
	'SecureFailure',
	'WireMessageValidator',
	'SecurePacketValidator',
	'RemoteInputValidator',
	'SecureChannelService',
	'WireSessionService',
	'WireClientService',
	'HostPairingService',
	'DevicePairingService',
	'DeviceConnectionService',
	'EventLogService',
	'ResponseLedgerService',
	'remoteIdentity',
	'credentialHash',
	'pkceChallenge',
	'remotePatterns',
	'randomId',
	'randomCredential',
	'remoteKeys',
	'importRemoteKeys',
	'exportRemoteKeys',
	'pairingOffer',
	'readPairingOffer',
	'offerEnvironment',
	'offerRules',
	'remoteScanFailures',
	'relayOrigin',
	'relaySocketUrl',
	'remoteBytes',
	'bytesText',
	'toBase64Url',
	'fromBase64Url',
	'toBase64',
	'fromBase64',
	'toHex',
	'concatBytes',
	'sha256',
	'randomBytes',
	'safeEqual'
];
test('the package exports the protocol surface', () => {
	for (const name of names) expect(remote, name).toHaveProperty(name);
	expect(remote.REMOTE_PROTOCOL).toBe(1);
});
test('folders, hosted credentials and the control port are never device methods', () => {
	const device: readonly string[] = [
		remote.attachMethod,
		...remote.readMethods,
		...remote.commentMethods,
		...remote.agentMethods
	];
	for (const method of [...remote.localMethods, ...remote.controlMethods])
		expect(device).not.toContain(method);
	expect(new Set(remote.remoteMethods).size).toBe(remote.remoteMethods.length);
});
