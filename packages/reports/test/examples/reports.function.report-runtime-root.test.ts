import { test, vi } from 'vitest';
import { expect } from '../../../../test/verificationExpect';
import { recordExampleCases } from '../../../../test/support/recordExampleCases';
import { reportRuntimeRoot } from '../../src/utils/reports-media/reportRuntimeRoot';

const OVERRIDE = '/opt/harness/reports-runtime';

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
