import { test } from 'vitest';
import { expect } from '../verificationExpect';
import { recordExampleCases } from '../support/recordExampleCases';
import type { PlanInput } from '../../src/utils/verification-evidence/verifyPlan';
import { verifyPlan } from '../../src/workflows/verification-evidence/run-verify/verification-service/verifyPlan';

function baseConfig(): PlanInput['config'] {
	return {
		schemaVersion: 1, setup: [], link: ['node_modules'], outputs: [], builds: [], tools: [],
		profiles: {}, checks: [],
		runners: { vitest: 'bun x vitest run {target}', playwright: 'bun x playwright test {target}' },
		timeouts: { test: 600000 }
	};
}

function baseUnits(): PlanInput['unitsConfig'] {
	return {
		schemaVersion: 1, workspaces: [{ name: '', root: '.' }], tests: ['test/', 'tests/'], global: [],
		ignored: ['**/*.md', 'specification/features/', 'specification/loops/', '.gitignore'], references: []
	};
}

function selectedFilesInput(): PlanInput {
	return {
		selectedTests: ['tests/utils/classifyPath.test.ts', 'tests/verification-evidence/verifyPlan.test.ts'],
		scenarios: [], config: baseConfig(), unitsConfig: baseUnits()
	};
}

function scenarioInput(): PlanInput {
	const scenario: PlanInput['scenarios'][number] = {
		schemaVersion: 1, id: 'evidence-grid.populated', title: 'Evidence grid populated', kind: 'ui',
		units: ['reports.component.evidence-grid'],
		states: [{ id: 'populated', title: 'Grid shows recorded evidence', coverage: 'required' }],
		viewports: [{ id: 'desktop', width: 1280, height: 800 }],
		tests: [{ id: 'renders', kind: 'e2e', runner: 'playwright', target: 'tests/e2e/evidence-grid.spec.ts', cwd: 'apps/web', timeoutMs: 240000 }],
		evidence: [{ id: 'grid-screenshot', kind: 'screenshot', states: ['populated'], viewports: ['desktop'], required: true }]
	};
	return {
		selectedTests: ['apps/web/tests/e2e/evidence-grid.spec.ts', 'apps/web/tests/format.test.ts', 'tests/verification-evidence/verifyPlan.test.ts'],
		scenarios: [scenario],
		config: {
			...baseConfig(),
			checks: [{ path: 'tests/verification-evidence/verifyPlan.test.ts', command: 'bun x vitest run {target}', timeoutMs: 120000 }]
		},
		unitsConfig: { ...baseUnits(), workspaces: [...baseUnits().workspaces, { name: 'web', root: 'apps/web' }] },
		testTimeoutMs: 300000
	};
}

function summarize(input: PlanInput) {
	return verifyPlan(input).map(({ id, scenario, name, kind, runner, target, cwd, command, timeoutMs }) => ({
		id, ...(scenario ? { scenario } : {}), name, kind, runner, target, cwd, command, timeoutMs
	}));
}

test('Plans selected files and scenario checks in run order', () => {
	const cases = [
		{
			name: 'selected files sort by path and use the configured fallback timeout',
			input: selectedFilesInput(),
			output: [
				{ id: 'tests/utils/classifyPath.test.ts', name: 'tests/utils/classifyPath.test.ts', kind: 'unit', runner: 'vitest', target: 'tests/utils/classifyPath.test.ts', cwd: '.', command: 'bun x vitest run tests/utils/classifyPath.test.ts', timeoutMs: 600000 },
				{ id: 'tests/verification-evidence/verifyPlan.test.ts', name: 'tests/verification-evidence/verifyPlan.test.ts', kind: 'unit', runner: 'vitest', target: 'tests/verification-evidence/verifyPlan.test.ts', cwd: '.', command: 'bun x vitest run tests/verification-evidence/verifyPlan.test.ts', timeoutMs: 600000 }
			]
		},
		{
			name: 'workspace checks and scenario checks use their own commands and timeouts',
			input: scenarioInput(),
			output: [
				{ id: 'apps/web/tests/format.test.ts', name: 'apps/web/tests/format.test.ts', kind: 'unit', runner: 'vitest', target: 'apps/web/tests/format.test.ts', cwd: 'apps/web', command: 'bun x vitest run tests/format.test.ts', timeoutMs: 300000 },
				{ id: 'tests/verification-evidence/verifyPlan.test.ts', name: 'tests/verification-evidence/verifyPlan.test.ts', kind: 'unit', runner: 'vitest', target: 'tests/verification-evidence/verifyPlan.test.ts', cwd: '.', command: 'bun x vitest run tests/verification-evidence/verifyPlan.test.ts', timeoutMs: 120000 },
				{ id: 'evidence-grid.populated:renders', scenario: 'evidence-grid.populated', name: 'renders', kind: 'e2e', runner: 'playwright', target: 'tests/e2e/evidence-grid.spec.ts', cwd: 'apps/web', command: 'bun x playwright test tests/e2e/evidence-grid.spec.ts', timeoutMs: 240000 }
			]
		}
	].map((example) => {
		const output = summarize(example.input);
		expect(output).toEqual(example.output);
		return { name: example.name, input: example.input, output };
	});
	recordExampleCases({
		unitId: 'function.verify-plan', symbol: 'verifyPlan',
		state: 'plans-selected-files-and-scenario-checks-in-run-order',
		evidence: 'examples-cases', file: 'plans-selected-files-and-scenario-checks-in-run-order.json'
	}, cases);
});
