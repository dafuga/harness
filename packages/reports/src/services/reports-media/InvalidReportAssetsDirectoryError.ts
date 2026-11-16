// @harness-uid u_5q7ojstspr
export class InvalidReportAssetsDirectoryError extends Error {
	constructor() {
		super('Invalid report assets directory');
		this.name = 'InvalidReportAssetsDirectoryError';
	}
}
