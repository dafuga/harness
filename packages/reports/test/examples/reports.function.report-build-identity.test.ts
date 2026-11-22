import { mkdtempSync, mkdirSync, rmSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { test } from 'vitest';
import { expect } from '../../../../test/verificationExpect';
import { recordExampleCases } from '../../../../test/support/recordExampleCases';
import { reportBuildIdentity } from '../../src/utils/reports-media/reportBuildIdentity';

test('Identifies and caches report builds', () => {
	const root = mkdtempSync(join(tmpdir(), 'report-build-identity-'));
	try {
		const missing = join(root, 'missing');
		const empty = join(root, 'empty');
		const build = join(root, 'build');
		mkdirSync(empty);
		mkdirSync(build);
		writeFileSync(join(build, 'handler.js'), 'first build');

		const missingIdentity = reportBuildIdentity(missing);
		const emptyIdentity = reportBuildIdentity(empty);
		const firstIdentity = reportBuildIdentity(build);
		writeFileSync(join(build, 'handler.js'), 'changed build');
		const cachedIdentity = reportBuildIdentity(build);

		expect(missingIdentity).toBe('harness-reports-development');
		expect(emptyIdentity).toBe('harness-reports-development');
		expect(firstIdentity).not.toBe('harness-reports-development');
		expect(cachedIdentity).toBe(firstIdentity);
		recordExampleCases(
			{
				unitId: 'reports.function.report-build-identity',
				symbol: 'reportBuildIdentity',
				state: 'identifies-and-caches-report-builds',
				evidence: 'examples-cases',
				file: 'identifies-and-caches-report-builds.json'
			},
			[
				{
					name: 'missing directory uses development identity',
					input: { directory: 'missing' },
					output: missingIdentity
				},
				{
					name: 'directory without files uses development identity',
					input: { directory: 'empty' },
					output: emptyIdentity
				},
				{
					name: 'compiled files determine an identity cached by directory',
					input: { directory: 'build', fileBefore: 'first build', fileAfter: 'changed build' },
					output: { firstIdentity, identityAfterFileChange: cachedIdentity }
				}
			]
		);
	} finally {
		rmSync(root, { recursive: true, force: true });
	}
});

test('Throws Error when the directory cannot be enumerated', () => {
	const root = mkdtempSync(join(tmpdir(), 'report-build-error-'));
	try {
		const file = join(root, 'not-a-directory');
		writeFileSync(file, 'content');
		let message = '';
		try {
			reportBuildIdentity(file);
		} catch (error) {
			message = error instanceof Error ? error.message : String(error);
		}
		expect(message).toContain('ENOTDIR');
		recordExampleCases(
			{
				unitId: 'reports.function.report-build-identity',
				symbol: 'reportBuildIdentity',
				state: 'throws-error-when-the-directory-cannot-be-enumerated',
				evidence: 'examples-cases',
				file: 'throws-error-when-the-directory-cannot-be-enumerated.json'
			},
			[{ name: 'a regular file cannot be enumerated as a directory', input: { directory: 'not-a-directory' }, error: message }]
		);
	} finally {
		rmSync(root, { recursive: true, force: true });
	}
});
