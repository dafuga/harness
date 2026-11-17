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
