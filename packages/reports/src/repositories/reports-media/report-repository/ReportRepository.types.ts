// @harness-uid u_supmadumal
export class InvalidReportDirectoryError extends Error {
	override name = 'InvalidReportDirectoryError';
}

export class ReportNotActiveError extends Error {
	override name = 'ReportNotActiveError';
}

export class ReportAlreadyFinalizedError extends Error {
	override name = 'ReportAlreadyFinalizedError';
}

export class ReportNotFinalizingError extends Error {
	override name = 'ReportNotFinalizingError';
}
