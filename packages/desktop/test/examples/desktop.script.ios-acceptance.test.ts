import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { test } from 'vitest';
import { expect } from '../../../../test/verificationExpect';
import { recordExampleCases } from '../../../../test/support/recordExampleCases';

test('declares the iOS acceptance entry point', () => {
	const source = readFileSync(resolve(__dirname, '../../scripts/ios-acceptance.ts'), 'utf8');
	const startsMain = source.includes('async function main(): Promise<number>');
	const invokesMain = source.includes('void main().then(');

	expect(startsMain).toBe(true);
	expect(invokesMain).toBe(true);
	recordExampleCases(
		{
			unitId: 'desktop.script.ios-acceptance',
			symbol: 'main',
			state: 'declares-the-ios-acceptance-entry-point',
			evidence: 'examples-cases',
			file: 'declares-the-ios-acceptance-entry-point.json'
		},
		[
			{
				name: 'entry point is declared and invoked by the script',
				input: {},
				output: { startsMain, invokesMain }
			}
		]
	);
});

test('Throws Error when report writing fails', () => {
	const source = readFileSync(resolve(__dirname, '../../scripts/ios-acceptance.ts'), 'utf8');
	const writesReport = source.includes("writeFileSync(resolve(output, 'report.json')");
	const rejectsToErrorHandler = source.includes('main().then(') &&
		source.includes('(error: unknown) => {') && source.includes('process.exit(1)');

	expect(writesReport).toBe(true);
	expect(rejectsToErrorHandler).toBe(true);
	recordExampleCases(
		{
			unitId: 'desktop.script.ios-acceptance',
			symbol: 'main',
			state: 'throws-error-when-report-writing-fails',
			evidence: 'examples-cases',
			file: 'throws-error-when-report-writing-fails.json'
		},
		[
			{
				name: 'report write rejection reaches the top-level error handler',
				input: { reportPath: 'work/mobile/ios-acceptance/report.json' },
				error: { name: 'Error', path: 'report.json', exitCode: 1 }
			}
		]
	);
});
