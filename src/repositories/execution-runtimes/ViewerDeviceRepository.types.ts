// @harness-uid u_qvo6rcr4rm
export interface ViewerDevice {
	hash: string;
	approvedAt: string;
}

export interface ViewerPairing {
	hash: string;
	code: string;
	expiresAt: number;
}

export interface ViewerDevices {
	version: 1;
	devices: ViewerDevice[];
	pending: ViewerPairing[];
}

export type ViewerAccess =
	| { status: 'approved' }
	| { status: 'pending'; code: string }
	| { status: 'unknown' };
