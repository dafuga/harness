import { test } from 'vitest';
import { expect } from '../verificationExpect';
import { recordExampleCases } from '../support/recordExampleCases';
import type { CoverageInput } from '../../src/utils/verification-evidence/scenarioCoverage.types';
import { scenarioCoverage } from '../../src/workflows/verification-evidence/run-verify/verification-service/scenarioCoverage';

const missingRequiredCapture = {
	scenario: {
		schemaVersion: 1,
		id: 'runtime-evidence-ui',
		title: 'Runtime evidence viewer',
		kind: 'ui',
		units: ['desktop.component.runtime-pane'],
		states: [{ id: 'current', title: 'current', coverage: 'required' }],
		viewports: [{ id: 'desktop', width: 1440, height: 900 }],
		tests: [
			{
				id: 'screens',
				kind: 'e2e',
				runner: 'command',
				target: 'bun test/screens.spec.ts',
				cwd: 'packages/desktop',
				timeoutMs: 240000
			}
		],
		evidence: [
			{
				id: 'runtime-screens-desktop',
				kind: 'screenshot',
				states: ['current'],
				viewports: ['desktop'],
				provenance: 'actual-capture',
				capture: 'full-page',
				required: true
			}
		]
	},
	commit: '4f8c2a71e0b93d56a1c7e2f9b04d8e35c6a71b20',
	gathered: [],
	checkFailed: false
} satisfies CoverageInput;

test('Reports required states and captures that are missing', () => {
	const result = scenarioCoverage(missingRequiredCapture);
	expect(result.states.map(({ id, coverage }) => ({ id, coverage }))).toEqual([
		{ id: 'current', coverage: 'required' }
	]);
	expect(result.failures).toContain(
		'runtime-evidence-ui: missing screenshot for state current at viewport desktop'
	);
	recordExampleCases(
		{
			unitId: 'function.scenario-coverage',
			symbol: 'scenarioCoverage',
			state: 'reports-required-states-and-captures-that-are-missing',
			evidence: 'examples-cases',
			file: 'reports-required-states-and-captures-that-are-missing.json'
		},
		[
			{
				name: 'required screenshot slot was not gathered',
				input: { scenario: missingRequiredCapture.scenario, gathered: [] },
				output: { states: result.states, failures: result.failures }
			}
		]
	);
});
