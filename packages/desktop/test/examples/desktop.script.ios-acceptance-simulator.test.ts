import { existsSync, mkdtempSync, readFileSync, rmSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { test, vi } from 'vitest';
import { expect } from '../../../../test/verificationExpect';
import { recordExampleCases } from '../../../../test/support/recordExampleCases';
import {
	deviceName,
	bundleId,
	acceptanceDevice,
	install,
	launch,
	cameraAccess,
	running,
	screenshot,
	inspectorSocket,
	keychainGroups,
	shutdown
} from '../../scripts/ios-acceptance-simulator';
import type { Device, Runtime } from '../../scripts/ios-acceptance-simulator.types';

const UNIT = 'desktop.script.ios-acceptance-simulator';
const UDID = '6D5A4E3C-2B1A-4F08-9C7D-1234567890AB';

// Fake simctl and sqlite3 in the temporary folder. They log each simctl call and print the
// fixture file named after the subcommand (list-devices.out, spawn.out, ...); *.fail makes them exit 1.
const FAKE_XCRUN = `#!/bin/sh
D=\${0%/*}
shift
KEY=$1
if [ "$1" = list ]; then KEY="list-$2"; fi
echo "$*" >> "$D/calls.log"
if [ -f "$D/$KEY.fail" ]; then exit 1; fi
if [ -f "$D/$KEY.out" ]; then /bin/cat "$D/$KEY.out"; fi
exit 0
`;

const FAKE_SQLITE = `#!/bin/sh
D=\${0%/*}
if [ -f "$D/sqlite3.fail" ]; then exit 1; fi
if [ -f "$D/sqlite3.out" ]; then /bin/cat "$D/sqlite3.out"; fi
exit 0
`;

const deviceType = (name: string, productFamily: string) => ({
	name,
	identifier: `com.apple.CoreSimulator.SimDeviceType.${name.replace(/ /g, '-')}`,
	productFamily
});

function runtimeOf(
	version: string,
	isAvailable: boolean,
	types: Runtime['supportedDeviceTypes']
): Runtime {
	const identifier = `com.apple.CoreSimulator.SimRuntime.iOS-${version.replace('.', '-')}`;
	return { identifier, version, isAvailable, supportedDeviceTypes: types };
}

const OLD = runtimeOf('25.0', true, [deviceType('iPhone 16', 'iPhone')]);
const NEW = runtimeOf('26.0', true, [
	deviceType('iPad Pro', 'iPad'),
	deviceType('iPhone 17', 'iPhone'),
	deviceType('iPhone 17 Pro', 'iPhone')
]);
const UNAVAILABLE = runtimeOf('26.1', false, [deviceType('iPhone 17 Pro', 'iPhone')]);
const EXISTING: Device = { name: deviceName, udid: UDID, isAvailable: true };

function listDevices(devices: Device[]): string {
	return JSON.stringify({ devices: { 'com.apple.CoreSimulator.SimRuntime.iOS-26-0': devices } });
}

function listRuntimes(runtimes: Runtime[]): string {
	return JSON.stringify({ runtimes });
}

function meta(symbol: string, state: string) {
	return { unitId: UNIT, symbol, state, evidence: 'examples-cases', file: `${state}.json` };
}

// Runs the body with PATH pointing only at the temporary folder, then removes the folder.
function runIn<T>(files: Record<string, string>, body: (dir: string) => T) {
	const dir = mkdtempSync(join(tmpdir(), 'ios-acceptance-sim-'));
	try {
		const fakes = { xcrun: FAKE_XCRUN, sqlite3: FAKE_SQLITE };
		for (const [name, text] of Object.entries({ ...fakes, ...files })) {
			writeFileSync(join(dir, name), text, { mode: 0o755 });
		}
		vi.stubEnv('PATH', dir);
		const value = body(dir);
		const log = join(dir, 'calls.log');
		const calls = existsSync(log) ? readFileSync(log, 'utf8').trim().split('\n') : [];
		return { value, calls };
	} finally {
		vi.unstubAllEnvs();
		rmSync(dir, { recursive: true, force: true });
	}
}

function attempt<T>(run: () => T): { output: T } | { error: { name: string; message: string } } {
	try {
		return { output: run() };
	} catch (failure) {
		const { name, message } = failure as Error;
		return { error: { name, message } };
	}
}

test('Reuses the named device, erasing it before boot', () => {
	const files = { 'list-devices.out': listDevices([EXISTING]), 'getenv.out': '26.0\n' };
	const { value, calls } = runIn(files, () => acceptanceDevice());

	expect(value).toEqual({ udid: UDID, runtime: '26.0' });
	expect(calls).toEqual([
		'list devices -j',
		`shutdown ${UDID}`,
		`erase ${UDID}`,
		`boot ${UDID}`,
		`bootstatus ${UDID} -b`,
		`getenv ${UDID} SIMULATOR_RUNTIME_VERSION`
	]);

	recordExampleCases(meta('acceptanceDevice', 'reuses-the-named-device-erasing-it-before-boot'), [
		{ name: 'existing device by name is reused', input: { deviceName }, output: value },
		{ name: 'erase, boot and bootstatus run in order', input: { udid: UDID }, output: calls }
	]);
});

test('Creates the device on the newest runtime when none exists', () => {
	const files = {
		'list-devices.out': listDevices([]),
		'list-runtimes.out': listRuntimes([OLD, NEW]),
		'create.out': `${UDID}\n`,
		'getenv.out': '26.0\n'
	};
	const { value, calls } = runIn(files, () => acceptanceDevice());
	const type = 'com.apple.CoreSimulator.SimDeviceType.iPhone-17-Pro';
	const runtime = 'com.apple.CoreSimulator.SimRuntime.iOS-26-0';

	expect(value).toEqual({ udid: UDID, runtime: '26.0' });
	expect(calls[2]).toBe(`create ${deviceName} ${type} ${runtime}`);

	recordExampleCases(
		meta('acceptanceDevice', 'creates-the-device-on-the-newest-runtime-when-none-exists'),
		[
			{
				name: 'newest iOS runtime with the iPhone 17 Pro type',
				input: { runtimes: ['25.0', '26.0'] },
				output: { udid: value.udid, runtime: value.runtime, create: calls[2] }
			}
		]
	);
});

test('Rejects when no iOS runtime is installed', () => {
	const files = {
		'list-devices.out': listDevices([]),
		'list-runtimes.out': listRuntimes([UNAVAILABLE])
	};
	const { value, calls } = runIn(files, () => attempt(() => acceptanceDevice()));

	expect(value).toMatchObject({
		error: {
			name: 'IosAcceptanceSimulatorError',
			message: 'No iOS simulator runtime is installed.'
		}
	});
	expect(calls).toEqual(['list devices -j', 'list runtimes -j']);

	recordExampleCases(meta('acceptanceDevice', 'rejects-when-no-ios-runtime-is-installed'), [
		{ name: 'only an unavailable iOS runtime exists', input: { runtimes: ['26.1'] }, ...value }
	]);
});

test('Sets camera access, installs and launches the app', () => {
	const { calls } = runIn({}, () => {
		cameraAccess(UDID, 'grant');
		install(UDID, '/tmp/Harness.app');
		launch(UDID, ['--acceptance', 'camera-permission']);
	});

	expect(calls).toEqual([
		`privacy ${UDID} grant camera ${bundleId}`,
		`install ${UDID} /tmp/Harness.app`,
		`launch --terminate-running-process ${UDID} ${bundleId} --acceptance camera-permission`
	]);

	recordExampleCases(meta('install', 'sets-camera-access-installs-and-launches-the-app'), [
		{
			name: 'grant camera access to the app',
			input: { udid: UDID, access: 'grant' },
			output: calls[0]
		},
		{
			name: 'install the app product',
			input: { udid: UDID, product: '/tmp/Harness.app' },
			output: calls[1]
		},
		{
			name: 'launch with acceptance arguments',
			input: { udid: UDID, args: ['--acceptance', 'camera-permission'] },
			output: calls[2]
		}
	]);
});

test('Captures the screen, checks the app and shuts down', () => {
	const files = { 'spawn.out': `123\t0\tUIKitApplication:${bundleId}[4f1]\n` };
	const { value, calls } = runIn(files, (dir) => {
		screenshot(UDID, '/tmp/ios-acceptance.png');
		const listed = running(UDID);
		writeFileSync(join(dir, 'spawn.out'), '123\t0\tcom.apple.springboard\n');
		const unlisted = running(UDID);
		writeFileSync(join(dir, 'shutdown.fail'), '');
		shutdown(UDID);
		return { listed, unlisted };
	});

	expect(value).toEqual({ listed: true, unlisted: false });
	expect(calls[0]).toBe(`io ${UDID} screenshot /tmp/ios-acceptance.png`);
	expect(calls[calls.length - 1]).toBe(`shutdown ${UDID}`);

	recordExampleCases(meta('screenshot', 'captures-the-screen-checks-the-app-and-shuts-down'), [
		{
			name: 'screenshot written to the requested file',
			input: { file: '/tmp/ios-acceptance.png' },
			output: calls[0]
		},
		{ name: 'app entry listed in launchctl', input: { udid: UDID }, output: value.listed },
		{ name: 'only other processes listed', input: { udid: UDID }, output: value.unlisted },
		{ name: 'shutdown tolerates a failing simctl', input: { udid: UDID }, output: null }
	]);
});

test('Reads the inspector socket and Keychain access groups', () => {
	const files = { 'getenv.out': '/tmp/webinspector.sock\n', 'sqlite3.out': `${bundleId}\n` };
	const { value } = runIn(files, (dir) => {
		const socket = inspectorSocket(UDID);
		const groups = keychainGroups(UDID);
		writeFileSync(join(dir, 'sqlite3.fail'), '');
		return { socket, groups, failure: attempt(() => keychainGroups(UDID)) };
	});

	expect(value.socket).toBe('/tmp/webinspector.sock');
	expect(value.groups).toEqual([bundleId]);
	expect(value.failure).toMatchObject({ error: { name: 'IosAcceptanceSimulatorError' } });

	recordExampleCases(
		meta('keychainGroups', 'reads-the-inspector-socket-and-keychain-access-groups'),
		[
			{
				name: 'inspector socket from RWI_LISTEN_SOCKET',
				input: { udid: UDID },
				output: value.socket
			},
			{ name: 'Keychain access group of the app', input: { udid: UDID }, output: value.groups },
			{ name: 'Keychain database read fails', input: { udid: UDID }, ...value.failure }
		]
	);
});
