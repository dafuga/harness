import { test } from 'vitest';
import { expect } from '../verificationExpect';
import { recordExampleCases } from '../support/recordExampleCases';
import {
	recordedDone,
	renderUnitsGuide
} from '../../src/workflows/development-tooling/guide-units/guideUnits';
import type { GuideReport } from '../../src/workflows/development-tooling/guide-units/guideUnits.types';

const unitId = 'workflow.development-tooling-guide-units';

test('Recognizes usable passed state evidence', () => {
	const captures = [
		{
			scenario: 'required-unit-states',
			state: 'default',
			capture: {
				evidence: 'unit-state-assertions',
				kind: 'assertions' as const,
				state: 'default',
				status: 'passed' as const,
				path: 'evidence/unit-state-default.json',
				sha256: 'c2f8a15e9d046b3ae71f2c85b0d9e3467a1c5f92d8b30e4cf6a9d2175e0b8c3f',
				mediaType: 'application/json',
				capturedAt: '2026-11-15T10:30:00.000Z',
				media: '.harness/records/example/unit-state-default.json'
			},
			standing: 'fresh' as const,
			usable: true,
			current: true,
			inheritedFrom: null
		}
	];
	const result = recordedDone(captures, unitId, 'default');
	expect(result).toBe(true);
	recordExampleCases(
		{
			unitId,
			symbol: 'recordedDone',
			state: 'recognizes-usable-passed-state-evidence',
			evidence: 'examples-cases',
			file: 'recognizes-usable-passed-state-evidence.json'
		},
		[
			{
				name: 'usable passed assertion capture matches the required state',
				input: { captures, unitId, name: 'default' },
				output: result
			}
		]
	);
});

test('Renders a missing-state report with its next commands', () => {
	const report: GuideReport = {
		entity: unitId,
		commit: '0123456789abcdef0123456789abcdef01234567',
		states: [
			{
				name: 'default',
				origin: 'REQUIRED',
				reasons: ['Default presentation.'],
				tests: [],
				viewports: { desktop: 'MISSING', tablet: 'MISSING', mobile: 'MISSING' },
				status: 'MISSING'
			}
		],
		guesses: [],
		summary: { done: 0, missing: 1 },
		next: {
			state: 'default',
			commands: [
				"${EDITOR:-vi} 'tests/e2e/component-catalog.spec.ts' # Write/extend \"default\" for workflow.development-tooling-guide-units, then commit the test.",
				'harness verify run --priority agent-test --entity workflow.development-tooling-guide-units',
				'harness units guide workflow.development-tooling-guide-units'
			]
		},
		proof: { store: 'git', gap: 'No attached Harness verification evidence at this revision.' }
	};
	const output = renderUnitsGuide(report);
	expect(output).toContain('0/1 DONE.');
	expect(output).toContain('NEXT: default');
	recordExampleCases(
		{
			unitId,
			symbol: 'renderUnitsGuide',
			state: 'renders-a-missing-state-report-with-its-next-commands',
			evidence: 'examples-cases',
			file: 'renders-a-missing-state-report-with-its-next-commands.json'
		},
		[
			{
				name: 'missing state includes completion summary and next guidance',
				input: report,
				output
			}
		]
	);
});
