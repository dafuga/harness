import { existsSync, mkdtempSync, readFileSync, rmSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { test, vi } from 'vitest';
import { expect } from '../../../../test/verificationExpect';
import { recordExampleCases } from '../../../../test/support/recordExampleCases';
import { deviceName, acceptanceDevice } from '../../scripts/ios-acceptance-simulator';
import type { Device } from '../../scripts/ios-acceptance-simulator.types';

const UNIT = 'desktop.script.ios-acceptance-simulator';
export const UDID = '6D5A4E3C-2B1A-4F08-9C7D-1234567890AB';

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
const EXISTING: Device = { name: deviceName, udid: UDID, isAvailable: true };

export function listDevices(devices: Device[]): string {
	return JSON.stringify({ devices: { 'com.apple.CoreSimulator.SimRuntime.iOS-26-0': devices } });
}

export function meta(symbol: string, state: string) {
	return { unitId: UNIT, symbol, state, evidence: 'examples-cases', file: `${state}.json` };
}

// Runs the body with PATH pointing only at the temporary folder, then removes the folder.
export function runIn<T>(files: Record<string, string>, body: (dir: string) => T) {
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
