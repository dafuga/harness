// @harness-uid u_5q7ojstspr
export class InvalidCleanupTimeError extends Error {
	constructor() {
		super('Invalid cleanup time');
		this.name = 'InvalidCleanupTimeError';
	}
}

export class InvalidReportAssetsDirectoryError extends Error {
	constructor() {
		super('Invalid report assets directory');
		this.name = 'InvalidReportAssetsDirectoryError';
	}
}

export class InvalidReportExportsDirectoryError extends Error {
	constructor() {
		super('Invalid report exports directory');
		this.name = 'InvalidReportExportsDirectoryError';
	}
}
