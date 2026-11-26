// @harness-uid u_6y7cr2odui
/** Summary of one retention run as ReportRetentionService builds it; serialized unchanged. */
export interface RetentionResult {
	plannedReports: string[];
	deletedReports: string[];
	cloudObjects: number;
	pages: number;
	localFiles: number;
	errors: string[];
	dryRun: boolean;
}
