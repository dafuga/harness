// @harness-uid u_5q7ojstspr
export class InvalidReportExportsDirectoryError extends Error {
	constructor() {
		super('Invalid report exports directory');
		this.name = 'InvalidReportExportsDirectoryError';
	}
}
