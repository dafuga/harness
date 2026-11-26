// @harness-uid u_bit6m3gnax
/** A required simulator runtime or iPhone is unavailable, or its Keychain database cannot be read. */
export { IosAcceptanceSimulatorError } from './IosAcceptanceSimulatorError';

export interface Device {
	name: string;
	udid: string;
	isAvailable?: boolean;
}

export interface Runtime {
	identifier: string;
	version: string;
	isAvailable: boolean;
	supportedDeviceTypes: { name: string; identifier: string; productFamily: string }[];
}
