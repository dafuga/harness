export interface BrowserBaselineResult {
	status: string;
	errors?: Array<{ message?: string }>;
}
export interface BrowserBaselineCase {
	expectedStatus: string;
	status: string;
	results: BrowserBaselineResult[];
}
export interface BrowserBaselineSuite {
	specs?: Array<{ tests: BrowserBaselineCase[] }>;
	suites?: BrowserBaselineSuite[];
}
export interface BrowserBaselineReport {
	suites: BrowserBaselineSuite[];
	errors: unknown[];
	stats: { expected: number; unexpected: number; skipped: number; flaky: number };
}
