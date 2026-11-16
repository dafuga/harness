import { test } from 'vitest';
import { expect } from '../verificationExpect';
import { recordExampleCases } from '../support/recordExampleCases';
import type { GuidanceContext } from '../../src/workflows/development-tooling/guide-units/guideUnits.types';
import type { ComponentManifest } from '../../src/core/development-tooling/unitTypes';
import { stateTests } from '../../src/workflows/development-tooling/guide-units/stateTests';

const unitId = 'reports.component.evidence-grid';
const testFile = 'packages/reports/tests/e2e/explorer-shell.spec.ts';

function contextFor(): GuidanceContext {
	const scenario = {
		units: [unitId],
		states: [{ id: 'reports-component-evidence-grid-loading', coverage: 'required' }],
		tests: [
			{
				runner: 'command',
				cwd: 'packages/reports',
				target: 'vitest run tests/e2e/explorer-shell.spec.ts'
			}
		],
		viewports: [{ id: 'desktop' }, { id: 'tablet' }, { id: 'mobile' }]
	};
	return {
		loaded: {
			scenarios: [scenario],
			index: {
				files: new Map([[testFile, { path: testFile, classification: 'test' }]])
			}
		},
		tree: {},
		registries: [],
		texts: new Map(),
		testAttributions: new Map(),
		testSyntax: new Map([
			[testFile, { test: true, states: new Set(['loading']), matrix: false }]
		])
	} as unknown as GuidanceContext;
}

test('Finds a declared state test', async () => {
	const input = { state: 'loading', headless: true };
	const result = await stateTests(
		contextFor(),
		{ id: unitId } as ComponentManifest,
		input.state,
		{ headless: input.headless }
	);
	expect(result).toEqual([{ file: testFile, viewports: ['desktop', 'tablet', 'mobile'] }]);
	recordExampleCases(
		{
			unitId: 'workflow.development-tooling-guide-units-state-tests',
			symbol: 'stateTests',
			state: 'finds-a-declared-state-test',
			evidence: 'examples-cases',
			file: 'finds-a-declared-state-test.json'
		},
		[
			{
				name: 'declared loading state resolves its authored test and viewports',
				input,
				output: result
			}
		]
	);
});
