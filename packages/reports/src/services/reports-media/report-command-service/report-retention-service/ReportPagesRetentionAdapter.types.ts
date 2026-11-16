// @harness-uid u_3pdv54xqo7
export interface Deployment {
	Id: string;
	Environment: string;
	Branch: string;
	Deployment: string;
}

export class InvalidReportPublicationReceiptError extends Error {
	override name = 'InvalidReportPublicationReceiptError';
}

export class ReportPublicationProjectMismatchError extends Error {
	override name = 'ReportPublicationProjectMismatchError';
}

export class InvalidReportDeploymentIdError extends Error {
	override name = 'InvalidReportDeploymentIdError';
}

export class PublishedReportAbsentFromDeploymentListingError extends Error {
	override name = 'PublishedReportAbsentFromDeploymentListingError';
}

export class MissingProjectReportsCloudflareAccountError extends Error {
	override name = 'MissingProjectReportsCloudflareAccountError';
}

export class CloudflarePagesCleanupError extends Error {
	override name = 'CloudflarePagesCleanupError';
}
