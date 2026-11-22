import { test, vi } from 'vitest';
import { expect } from '../../../../test/verificationExpect';
import { recordExampleCases } from '../../../../test/support/recordExampleCases';
import { reportRuntimeRoot } from '../../src/utils/reports-media/reportRuntimeRoot';

const OVERRIDE = '/opt/harness/reports-runtime';
const RealURL = URL;

function ThrowingURL(): never {
	throw new TypeError('Invalid URL');
}

class HttpURL extends RealURL {
	constructor() {
		super('http://example.test/a/b/c/d');
	}
}

function rootWithEnv(value: string | undefined): string {
	vi.stubEnv('HARNESS_REPORTS_RUNTIME_ROOT', 'unused');
	if (value === undefined) {
		delete process.env.HARNESS_REPORTS_RUNTIME_ROOT;
	} else {
		vi.stubEnv('HARNESS_REPORTS_RUNTIME_ROOT', value);
	}
	try {
		return reportRuntimeRoot();
	} finally {
		vi.unstubAllEnvs();
	}
}

function errorWithUrl(urlStub: unknown): { name: string; message: string } {
	vi.stubEnv('HARNESS_REPORTS_RUNTIME_ROOT', 'unused');
	delete process.env.HARNESS_REPORTS_RUNTIME_ROOT;
	vi.stubGlobal('URL', urlStub);
	try {
		reportRuntimeRoot();
	} catch (error) {
		const { name, message } = error as TypeError;
		return { name, message };
	} finally {
		vi.unstubAllGlobals();
		vi.unstubAllEnvs();
	}
	throw new Error('expected reportRuntimeRoot to throw');
}

function summariseFallback(root: string) {
	return {
		isAbsolute: root.startsWith('/'),
		endsWithPackagesReports: root.endsWith('/packages/reports'),
		trailingSlash: root.endsWith('/')
	};
}

test('reports runtime root returns the override exactly when set', () => {
	const override = rootWithEnv(OVERRIDE);
	const empty = rootWithEnv('');

	expect(override).toBe(OVERRIDE);
	expect(empty).toBe('');
	recordExampleCases(
		{
			unitId: 'reports.function.report-runtime-root',
			symbol: 'reportRuntimeRoot',
			state: 'reports-runtime-root-returns-the-override-exactly-when-set',
			evidence: 'examples-cases',
			file: 'reports-runtime-root-returns-the-override-exactly-when-set.json'
		},
		[
			{
				name: 'override variable set to an absolute example path',
				input: { HARNESS_REPORTS_RUNTIME_ROOT: OVERRIDE },
				output: override
			},
			{
				name: 'override variable set to an empty string is returned unchanged',
				input: { HARNESS_REPORTS_RUNTIME_ROOT: '' },
				output: empty
			}
		]
	);
});

test('falls back to the packages reports folder when unset', () => {
	const fallback = rootWithEnv(undefined);
	const summary = summariseFallback(fallback);

	expect(summary.isAbsolute).toBe(true);
	expect(summary.endsWithPackagesReports).toBe(true);
	expect(summary.trailingSlash).toBe(false);
	recordExampleCases(
		{
			unitId: 'reports.function.report-runtime-root',
			symbol: 'reportRuntimeRoot',
			state: 'falls-back-to-the-packages-reports-folder-when-unset',
			evidence: 'examples-cases',
			file: 'falls-back-to-the-packages-reports-folder-when-unset.json'
		},
		[
			{
				name: 'override variable unset resolves the packages reports folder',
				input: {},
				output: summary
			}
		]
	);
});

test('Throws TypeError when the fallback URL cannot be resolved', () => {
	const caught = errorWithUrl(ThrowingURL);

	expect(caught.name).toBe('TypeError');
	recordExampleCases(
		{
			unitId: 'reports.function.report-runtime-root',
			symbol: 'reportRuntimeRoot',
			state: 'throws-typeerror-when-the-fallback-url-cannot-be-resolved',
			evidence: 'examples-cases',
			file: 'throws-typeerror-when-the-fallback-url-cannot-be-resolved.json'
		},
		[
			{
				name: 'override unset and the URL constructor rejects the relative path',
				input: { HARNESS_REPORTS_RUNTIME_ROOT: 'unset', relativePath: '../../..' },
				error: caught
			}
		]
	);
});

test('Throws TypeError when the fallback URL is not a file URL', () => {
	const caught = errorWithUrl(HttpURL);

	expect(caught.name).toBe('TypeError');
	recordExampleCases(
		{
			unitId: 'reports.function.report-runtime-root',
			symbol: 'reportRuntimeRoot',
			state: 'throws-typeerror-when-the-fallback-url-is-not-a-file-url',
			evidence: 'examples-cases',
			file: 'throws-typeerror-when-the-fallback-url-is-not-a-file-url.json'
		},
		[
			{
				name: 'override unset and the module URL resolves to an http scheme',
				input: { HARNESS_REPORTS_RUNTIME_ROOT: 'unset', moduleUrl: 'http://example.test/a/b/c/d' },
				error: caught
			}
		]
	);
});
