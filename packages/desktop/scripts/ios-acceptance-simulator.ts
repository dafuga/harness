import { homedir } from 'node:os';
import { resolve } from 'node:path';
import { tool, tried } from './ios-products';

/**
 * TEST ONLY. The simulator of the native acceptance run: one device of its own, by name, so
 * that no other simulator, and no app someone is looking at, is touched. It is erased before a
 * run, which also empties its Keychain, and shut down afterwards.
 */
export const deviceName = 'Harness Native Acceptance';
export const bundleId = 'com.dafuga.harness';

interface Device {
	name: string;
	udid: string;
	isAvailable?: boolean;
}
interface Runtime {
	identifier: string;
	version: string;
	isAvailable: boolean;
	supportedDeviceTypes: { name: string; identifier: string; productFamily: string }[];
}

function simctl(...args: string[]): string {
	return tool(['xcrun', 'simctl', ...args]).trim();
}

function newestRuntime(): Runtime {
	const { runtimes } = JSON.parse(simctl('list', 'runtimes', '-j')) as { runtimes: Runtime[] };
	const usable = runtimes.filter((item) => item.isAvailable && item.identifier.includes('iOS'));
	const order = (item: Runtime) => item.version.split('.').map(Number);
	usable.sort((a, b) => order(b)[0] - order(a)[0] || order(b)[1] - order(a)[1]);
	if (usable[0]) return usable[0];
	throw new Error('No iOS simulator runtime is installed.');
}

function existing(): string | null {
	const listed = JSON.parse(simctl('list', 'devices', '-j')) as {
		devices: Record<string, Device[]>;
	};
	const found = Object.values(listed.devices)
		.flat()
		.find((item) => item.name === deviceName && item.isAvailable !== false);
	return found?.udid ?? null;
}

function created(): string {
	const runtime = newestRuntime();
	const phones = runtime.supportedDeviceTypes.filter((item) => item.productFamily === 'iPhone');
	const type = phones.find((item) => item.name === 'iPhone 17 Pro') ?? phones[0];
	if (!type) throw new Error('The newest runtime supports no iPhone.');
	return simctl('create', deviceName, type.identifier, runtime.identifier);
}

/** The device of the run, empty and booted. Only the device with this name is ever erased. */
export function acceptanceDevice(): { udid: string; runtime: string } {
	const udid = existing() ?? created();
	tried(['xcrun', 'simctl', 'shutdown', udid]);
	simctl('erase', udid);
	simctl('boot', udid);
	simctl('bootstatus', udid, '-b');
	return { udid, runtime: simctl('getenv', udid, 'SIMULATOR_RUNTIME_VERSION') };
}

export function install(udid: string, product: string): void {
	simctl('install', udid, product);
}

/** Starts the app again, ending the one that ran. Arguments reach the app as launch arguments. */
export function launch(udid: string, args: string[] = []): void {
	simctl('launch', '--terminate-running-process', udid, bundleId, ...args);
}

/**
 * What the system of this simulator answers when the app asks for the camera. It is set here so
 * that no prompt of the system has to be pressed: the run presses nothing the system draws.
 */
export function cameraAccess(udid: string, access: 'grant' | 'revoke'): void {
	simctl('privacy', udid, access, 'camera', bundleId);
}

export function running(udid: string): boolean {
	return simctl('spawn', udid, 'launchctl', 'list').includes(`UIKitApplication:${bundleId}`);
}

export function screenshot(udid: string, file: string): void {
	simctl('io', udid, 'screenshot', file);
}

/** Where WebKit's inspector of this simulator listens. */
export function inspectorSocket(udid: string): string {
	return simctl('getenv', udid, 'RWI_LISTEN_SOCKET');
}

/**
 * The access groups of the items the app keeps in the Keychain of this simulator, read from the
 * system's own database without opening an item: which groups exist, never what they hold.
 */
export function keychainGroups(udid: string): string[] {
	const folder = `Library/Developer/CoreSimulator/Devices/${udid}/data/Library/Keychains`;
	const database = resolve(homedir(), folder, 'keychain-2-debug.db');
	const query = `select distinct agrp from genp where agrp like '%${bundleId}%'`;
	const { code, output } = tried(['sqlite3', '-readonly', database, query]);
	if (code !== 0) throw new Error('The Keychain database of the simulator could not be read.');
	return output.split('\n').filter(Boolean);
}

export function shutdown(udid: string): void {
	tried(['xcrun', 'simctl', 'shutdown', udid]);
}
