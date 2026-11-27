// @harness-uid u_4xkioha7wi
export class MacDeviceApprovalError extends Error {
	constructor(readonly code: string) {
		super('The Mac could not complete the device approval request.');
	}
}
