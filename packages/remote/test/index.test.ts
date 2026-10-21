import { expect, test } from 'vitest';
import { taskProfile } from '../../../test/support/taskProfiles';
import * as remote from '../src/index';
import { measureProcess } from '../../../test/support/cli-measurement/measureHarness';
import { runCommand } from '../../../test/support/cli';
import { resolve } from 'node:path';

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
test('the package exports the protocol surface', async () => {
	for (const name of names) expect(remote, name).toHaveProperty(name);
	expect(remote.REMOTE_PROTOCOL).toBe(1);
	await taskProfile(
		'remote.model.remote-types',
		'construct-every-wire-error',
		() =>
			Object.keys(remote.remoteErrorMessages).map(
				(code) => new remote.RemoteFailure(code as keyof typeof remote.remoteErrorMessages)
			),
		100
	);
	await taskProfile(
		'remote.model.remote-control-types',
		'serialize-scanner-failure-codes',
		() => JSON.stringify(remote.remoteScanFailures),
		100
	);
	const reasons = ['state', 'packet', 'counter', 'tag', 'size'] as const;
	const failures = () => reasons.map((reason) => new remote.SecureFailure(reason));
	expect(failures().map((failure) => failure.reason)).toEqual(reasons);
	await taskProfile(
		'remote.model.remote-secure-types',
		'construct-every-secure-error',
		failures,
		100
	);
	await profilePublicEntry();
});

async function profilePublicEntry() {
	const source = resolve(import.meta.dirname, '../src/index.ts');
	const program = `const remote = await import(${JSON.stringify(source)});
const names = ${JSON.stringify(names)};
if (names.some(name => !(name in remote))) throw new Error('Missing public export');
console.log(JSON.stringify({protocol:remote.REMOTE_PROTOCOL, checked:names.length}));`;
	const result = await measureProcess(
		{
			units: ['remote.entry.index'],
			workload: 'cold-bun-public-entry-import',
			target: 'module',
			command: ['bun', '--eval', program],
			cwd: process.cwd(),
			env: { HARNESS_RUNTIME_PROFILE_BOUNDARY: 'benchmark' }
		},
		runCommand
	);
	expect(JSON.parse(result.stdout)).toEqual({ protocol: 1, checked: names.length });
}
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
