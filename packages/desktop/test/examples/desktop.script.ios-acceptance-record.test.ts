import { test } from 'vitest';
import { expect } from '../../../../test/verificationExpect';
import { recordExampleCases } from '../../../../test/support/recordExampleCases';
import { AcceptanceRecord } from '../../scripts/ios-acceptance-record';
import type { AcceptanceCheck } from '../../scripts/ios-acceptance-record.types';

test('records phase checks and summarizes pass and failure counts', () => {
	const lines: string[] = [];
	const record = new AcceptanceRecord((line) => lines.push(line));
	record.begin('Preparing iOS simulator');
	record.hide('482901');
	const safeText = record.safe('Simulator is ready; code 482901');
	record.check(true, 'Simulator became available');
	record.check(0, 'Simulator launch succeeded');
	record.stopped('Simulator launch timed out\nAdditional detail');
	const checks: AcceptanceCheck[] = record.checks;
	const summary = {
		checks: checks.map(({ phase, name, passed }) => ({ phase, name, passed })),
		passed: record.passed,
		failed: record.failed,
		safeText,
		lines
	};

	expect(checks).toHaveLength(3);
	expect(checks[0]).toMatchObject({ phase: 'Preparing iOS simulator', passed: true });
	expect(checks[1]).toMatchObject({ name: 'Simulator launch succeeded', passed: false });
	expect(checks[2].name).toContain('the phase stopped: Simulator launch timed out');
	expect(record.passed).toBe(1);
	expect(record.failed).toBe(2);
	expect(safeText).not.toContain('482901');

	recordExampleCases(
		{
			unitId: 'desktop.script.ios-acceptance-record',
			symbol: 'AcceptanceRecord',
			state: 'records-phase-checks-and-summarizes-pass-and-failure-counts',
			evidence: 'examples-cases',
			file: 'records-phase-checks-and-summarizes-pass-and-failure-counts.json'
		},
		[
			{
				name: 'record checks and a stopped phase',
				input: {
					phase: 'Preparing iOS simulator',
					checks: [true, 0],
					stopped: 'Simulator launch timed out'
				},
				output: summary
			}
		]
	);
});
