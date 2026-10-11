interface ReportError {
	message?: string;
}

interface ReportSuite {
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

const colour = new RegExp(`${String.fromCharCode(27)}\\[[0-9;]*m`, 'g');
const longest = 1500;

function said(error: ReportError | undefined): string {
	return (error?.message ?? 'It gave no message.').replace(colour, '').trim().slice(0, longest);
}

function failed(suite: ReportSuite): string[] {
	const own = (suite.specs ?? []).flatMap((spec) => {
		const test = spec.tests.find((candidate) => candidate.status === 'unexpected');
		if (!test) return [];
		const errors = test.results.flatMap(
			(result) => result.errors ?? (result.error ? [result.error] : [])
		);
		return [`${spec.file}:${spec.line} › ${spec.title}\n${said(errors[0])}`];
	});
	return [...own, ...(suite.suites ?? []).flatMap(failed)];
}

/**
 * What a browser run reported about everything that went wrong, in the order it reported it:
 * each failed test with where it is and the first error it raised. A run that writes this report
 * leaves the errors out of what it prints, so its output alone cannot say why a test failed.
 */
export function runFailures(report: RunReport): string[] {
	return [
		...(report.errors ?? []).map((error) => said(error)),
		...(report.suites ?? []).flatMap(failed)
	];
}
