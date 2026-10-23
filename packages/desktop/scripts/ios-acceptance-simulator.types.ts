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
