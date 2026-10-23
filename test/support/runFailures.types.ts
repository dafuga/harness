export interface ReportError {
	message?: string;
}

export interface ReportSuite {
	specs?: Array<{
		title: string;
		file: string;
		line: number;
		tests: Array<{
			status: string;
			results: Array<{ error?: ReportError; errors?: ReportError[] }>;
		}>;
	}>;
	suites?: ReportSuite[];
}

/** The part of Playwright's JSON report that says which tests failed and why. */
export interface RunReport {
	/** Failures outside any test, such as a server that did not start. */
	errors?: ReportError[];
	suites?: ReportSuite[];
}
