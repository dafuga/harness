import { test } from 'vitest';
import { expect } from '../../../../test/verificationExpect';
import { recordExampleCases } from '../../../../test/support/recordExampleCases';
import {
	reportCloudPrefixes,
	reportLifetimeMs,
	reportRetention
} from '../../src/utils/reports-media/reportRetention';
import { InvalidReportRetentionTimestampError } from '../../src/utils/reports-media/reportRetention.types';

const startedAt = '2026-10-12T14:05:00.000Z';
const expiresAt = Date.parse(startedAt) + reportLifetimeMs;
const report = { startedAt };
const oneDayMs = 24 * 60 * 60 * 1000;

function asNumber(value: unknown): number {
	return value as number;
}

function errorText(run: () => unknown): string {
	try {
		run();
		return 'no error';
	} catch (error) {
		return error instanceof Error ? `${error.name}: ${error.message}` : String(error);
	}
}

test('Report expires exactly thirty days after its start', () => {
	const checks = [
		{ name: 'one millisecond before the expiry instant', now: expiresAt - 1 },
		{ name: 'at the expiry instant', now: expiresAt },
		{ name: 'one day after the expiry instant', now: expiresAt + oneDayMs }
	];
	const results = checks.map((check) => reportRetention(report, check.now));

	expect(results).toEqual([false, true, true]);
	recordExampleCases(
		{
			unitId: 'reports.function.report-retention',
			symbol: 'reportRetention',
			state: 'report-expires-exactly-thirty-days-after-its-start',
			evidence: 'examples-cases',
			file: 'report-expires-exactly-thirty-days-after-its-start.json'
		},
		checks.map((check, index) => ({
			name: check.name,
			input: { startedAt, now: check.now },
			output: results[index]
		}))
	);
});

test('Non-finite timestamps throw the retention timestamp error', () => {
	const checks = [
		{ name: 'start time is not a date', startedAt: 'not-a-date', now: expiresAt },
		{ name: 'check time is NaN', startedAt, now: Number.NaN },
		{ name: 'check time is null', startedAt, now: asNumber(null) },
		{ name: 'check time is a numeric string', startedAt, now: asNumber('1794745800000') }
	];
	const messages = checks.map((check) =>
		errorText(() => reportRetention({ startedAt: check.startedAt }, check.now))
	);

	expect(() => reportRetention({ startedAt: 'not-a-date' }, expiresAt)).toThrow(
		InvalidReportRetentionTimestampError
	);
	expect(() => reportRetention(report, Number.NaN)).toThrow('Invalid report retention timestamp');
	expect(messages).toEqual(
		checks.map(() => 'InvalidReportRetentionTimestampError: Invalid report retention timestamp')
	);
	recordExampleCases(
		{
			unitId: 'reports.function.report-retention',
			symbol: 'reportRetention',
			state: 'non-finite-timestamps-throw-the-retention-timestamp-error',
			evidence: 'examples-cases',
			file: 'non-finite-timestamps-throw-the-retention-timestamp-error.json'
		},
		checks.map((check, index) => ({
			name: check.name,
			input: { startedAt: check.startedAt, now: String(check.now) },
			error: messages[index]
		}))
	);
});

test('Retention lifetime and cloud prefixes are fixed constants', () => {
	const prefixes = ['report-evidence/runs/', 'uploaded-screenshots/runs/', 'published-reports/'];

	expect(reportLifetimeMs).toBe(2592000000);
	expect(reportCloudPrefixes).toEqual(prefixes);
	recordExampleCases(
		{
			unitId: 'reports.function.report-retention',
			symbol: 'reportLifetimeMs',
			state: 'retention-lifetime-and-cloud-prefixes-are-fixed-constants',
			evidence: 'examples-cases',
			file: 'retention-lifetime-and-cloud-prefixes-are-fixed-constants.json'
		},
		[
			{
				name: 'module constants shared by every report',
				input: { module: 'reportRetention' },
				output: { reportLifetimeMs, reportCloudPrefixes: prefixes }
			}
		]
	);
});
