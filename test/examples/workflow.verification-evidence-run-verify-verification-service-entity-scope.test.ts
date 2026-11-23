import type { ScenarioManifest } from '../../src/core/development-tooling/unitTypes';
import type { PlannedCheck } from '../../src/utils/verification-evidence/verifyPlan';
import { test } from 'vitest';
import { expect } from '../verificationExpect';
import { recordExampleCases } from '../support/recordExampleCases';
import {
	scopeFailure,
	scopedScenarios,
	scopedCheck
} from '../../src/workflows/verification-evidence/run-verify/verification-service/entityScope';

const unitId = 'workflow.verification-evidence-run-verify-verification-service-entity-scope';
const evidenceGrid = 'reports.component.evidence-grid';
const runSummary = 'reports.component.run-summary';

const catalog: ScenarioManifest = {
	schemaVersion: 1,
	id: 'component-catalog-previews',
	title: 'Component catalog previews',
	kind: 'ui',
	units: [evidenceGrid, runSummary],
	states: [
		{ id: 'default', title: 'Default', coverage: 'required' },
		{ id: 'empty', title: 'No evidence', coverage: 'required', units: [evidenceGrid] }
	],
	viewports: [{ id: 'desktop', width: 1280, height: 800 }],
	tests: [
		{
			id: evidenceGrid,
			kind: 'e2e',
			runner: 'playwright',
			target: 'tests/e2e/component-catalog.spec.ts'
		},
		{
			id: runSummary,
			kind: 'e2e',
			runner: 'playwright',
			target: 'tests/e2e/component-catalog.spec.ts'
		}
	],
	evidence: [
		{
			id: 'component-catalog-screenshot',
			kind: 'screenshot',
			states: ['default', 'empty'],
			viewports: ['desktop'],
			capture: 'element',
			required: true
		}
	]
};

const reportsPage: ScenarioManifest = {
	schemaVersion: 1,
	id: 'reports-page',
	title: 'Reports page',
	kind: 'ui',
	units: ['reports.page.overview'],
	states: [{ id: 'loaded', title: 'Loaded', coverage: 'required' }],
	viewports: [{ id: 'desktop', width: 1280, height: 800 }],
	tests: [
		{
			id: 'reports-page',
			kind: 'e2e',
			runner: 'playwright',
			target: 'tests/e2e/reports-page.spec.ts'
		}
	],
	evidence: []
};

const gridCheck: PlannedCheck = {
	id: 'component-catalog-previews:reports.component.evidence-grid',
	scenario: 'component-catalog-previews',
	name: evidenceGrid,
	kind: 'e2e',
	runner: 'playwright',
	target: 'tests/e2e/component-catalog.spec.ts',
	cwd: '.',
	command: 'bun x playwright test tests/e2e/component-catalog.spec.ts',
	timeoutMs: 600000
};

function recordMeta(symbol: string, state: string) {
	return {
		unitId,
		symbol,
		state,
		evidence: 'examples-cases',
		file: `${state}.json`
	};
}

function summarise(scenario: ScenarioManifest) {
	return {
		id: scenario.id,
		units: scenario.units,
		states: scenario.states.map((state) => state.id),
		evidence: (scenario.evidence ?? []).map((item) => ({ id: item.id, states: item.states }))
	};
}

test('States the partial scope of one entity', () => {
	const statement = scopeFailure(evidenceGrid);
	expect(statement).toBe(
		`Scoped to ${evidenceGrid}: only its scenario states ran, so this record is partial and never a full pass.`
	);
	recordExampleCases(recordMeta('scopeFailure', 'states-the-partial-scope-of-one-entity'), [
		{ name: 'evidence grid entity', input: { entity: evidenceGrid }, output: statement }
	]);
});

test('Keeps only the states that name the entity', () => {
	const scenarios = [catalog, reportsPage];
	const grid = scopedScenarios(scenarios, evidenceGrid).map(summarise);
	const runs = scopedScenarios(scenarios, runSummary).map(summarise);
	expect(grid).toEqual([
		{
			id: 'component-catalog-previews',
			units: [evidenceGrid],
			states: ['empty'],
			evidence: [{ id: 'component-catalog-screenshot', states: ['empty'] }]
		}
	]);
	expect(runs).toEqual([
		{
			id: 'component-catalog-previews',
			units: [runSummary],
			states: ['default'],
			evidence: [{ id: 'component-catalog-screenshot', states: ['default'] }]
		}
	]);
	recordExampleCases(recordMeta('scopedScenarios', 'keeps-only-the-states-that-name-the-entity'), [
		{
			name: 'evidence grid keeps its explicit empty state',
			input: { entity: evidenceGrid },
			output: grid
		},
		{
			name: 'run summary keeps the states that name no unit',
			input: { entity: runSummary },
			output: runs
		}
	]);
});

test('Refuses an entity that no scenario covers', () => {
	const missing = 'reports.page.missing';
	let error: unknown;
	try {
		scopedScenarios([catalog, reportsPage], missing);
	} catch (caught) {
		error = caught;
	}
	expect(error).toBeInstanceOf(Error);
	expect((error as Error).message).toContain('nothing can be verified for it');
	recordExampleCases(recordMeta('scopedScenarios', 'refuses-an-entity-that-no-scenario-covers'), [
		{
			name: 'unknown entity is refused',
			input: { entity: missing },
			error: { name: (error as Error).name, message: (error as Error).message }
		}
	]);
});

test('Adds an entity grep to a Playwright catalog check', () => {
	const narrowed = scopedCheck(gridCheck, evidenceGrid);
	expect(narrowed.command).toBe(
		`${gridCheck.command} --grep '(^| )reports\\.component\\.evidence-grid(:[^ ]+)? at '`
	);
	recordExampleCases(
		recordMeta('scopedCheck', 'adds-an-entity-grep-to-a-playwright-catalog-check'),
		[
			{
				name: 'evidence grid check gains a grep for its titles',
				input: { entity: evidenceGrid, command: gridCheck.command },
				output: { command: narrowed.command }
			}
		]
	);
});

test('Leaves a check that already selects tests unchanged', () => {
	const selected: PlannedCheck = {
		...gridCheck,
		command: `${gridCheck.command} --grep 'reports.component.run-summary'`
	};
	const other: PlannedCheck = { ...gridCheck, scenario: 'reports-page' };
	const unchanged = scopedCheck(selected, evidenceGrid);
	const untouched = scopedCheck(other, evidenceGrid);
	expect(unchanged).toBe(selected);
	expect(untouched).toBe(other);
	recordExampleCases(
		recordMeta('scopedCheck', 'leaves-a-check-that-already-selects-tests-unchanged'),
		[
			{
				name: 'check already selecting with --grep is returned as is',
				input: { entity: evidenceGrid, command: selected.command },
				output: { command: unchanged.command }
			},
			{
				name: 'check from another scenario is returned as is',
				input: { entity: evidenceGrid, scenario: other.scenario },
				output: { command: untouched.command }
			}
		]
	);
});
