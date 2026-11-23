import { registryGate } from '../../src/workflows/verification-evidence/run-verify/verification-service/record-assembly-service/VerificationGates';
import type { Registry } from '../../src/workflows/verification-evidence/run-verify/verification-service/record-assembly-service/VerificationGates.types';
import { recordExampleCases } from '../support/recordExampleCases';
import { withTempDir } from '../support/temporary';
import { expect } from '../verificationExpect';
import { test } from 'vitest';
import {
	verificationService,
	previewUnit,
	runLedgerGateExamples
} from './service.verification-gates.fixtures';

test('Registry gate preserves identities and validates previews', () => {
	const inputs: Array<{ name: string; input: { base: Registry; head: Registry } }> = [
		{
			name: 'an unchanged service identity',
			input: { base: { stored: [verificationService] }, head: { stored: [verificationService] } }
		},
		{
			name: 'a service identity removed from the head registry',
			input: { base: { stored: [verificationService] }, head: { stored: [] } }
		},
		{
			name: 'an active preview naming an undeclared scenario',
			input: { base: { stored: [] }, head: { stored: [previewUnit], scenarios: [] } }
		},
		{
			name: 'a retired preview is not checked',
			input: {
				base: { stored: [] },
				head: { stored: [{ ...previewUnit, status: 'retired' as const }], scenarios: [] }
			}
		}
	];
	const cases = inputs.map(({ name, input }) => ({
		name,
		input,
		output: registryGate(input.base, input.head)
	}));

	expect(cases.map(({ output }) => output)).toEqual([
		[],
		[
			'unit service.verification-gates was removed from the registry; identities may only be retired'
		],
		['reports.component.evidence-grid: unknown preview scenario reports.scenario.desktop'],
		[]
	]);
	recordExampleCases(
		{
			unitId: 'service.verification-gates',
			symbol: 'registryGate',
			state: 'registry-gate-preserves-identities-and-validates-previews',
			evidence: 'examples-cases',
			file: 'registry-gate-preserves-identities-and-validates-previews.json'
		},
		cases
	);
});

test('Ledger gate checks append-only cited records', async () => {
	const cases = await withTempDir('verification-gates-examples-', runLedgerGateExamples);
	const outputs = cases.map(({ output }) => output);
	expect(outputs).toEqual([
		[],
		[],
		[
			'budget baseline for reports.component.evidence-grid cites record abcdef012345, which is not available'
		],
		['budget ledger was rewritten; recorded baselines and approvals are append-only']
	]);
	recordExampleCases(
		{
			unitId: 'service.verification-gates',
			symbol: 'ledgerGate',
			state: 'ledger-gate-checks-append-only-cited-records',
			evidence: 'examples-cases',
			file: 'ledger-gate-checks-append-only-cited-records.json'
		},
		cases
	);
});
