import { mkdirSync, writeFileSync } from 'node:fs';
import { join } from 'node:path';
import { test } from 'vitest';
import {
	listScenarios,
	showScenario,
	checkScenarios
} from '../../src/cli/program/inspectScenarios';
import { recordExampleCases } from '../support/recordExampleCases';
import { withTempRepo } from '../support/temporary';
import { expect } from '../verificationExpect';

const scenario = {
	schemaVersion: 1,
	id: 'inspect-scenarios.listing',
	title: 'Scenario listing from the working tree',
	kind: 'headless',
	units: ['workflow.inspect-scenarios'],
	states: [{ id: 'listed', title: 'Listed scenario', coverage: 'required' }],
	viewports: [],
	tests: [
		{
			id: 'listing-test',
			kind: 'unit',
			runner: 'vitest',
			target: 'test/examples/workflow.inspect-scenarios.test.ts'
		}
	],
	builds: [],
	evidence: [
		{
			id: 'listing-assertions',
			kind: 'assertions',
			states: ['listed'],
			viewports: [],
			required: true
		}
	]
};

function writeScenario(root: string) {
	const directory = join(root, 'specification/scenarios');
	mkdirSync(directory, { recursive: true });
	writeFileSync(join(directory, `${scenario.id}.json`), JSON.stringify(scenario));
}

test('Lists valid scenarios with capture summaries', async () => {
	await withTempRepo(async ({ root }) => {
		writeScenario(root);
		const result = await listScenarios(root);
		expect(result).toHaveLength(1);
		expect(result[0]).toMatchObject({ id: scenario.id, captures: 1, unproven: 0, excluded: 0 });
		recordExampleCases(
			{
				unitId: 'workflow.inspect-scenarios',
				symbol: 'listScenarios',
				state: 'lists-valid-scenarios-with-capture-summaries',
				evidence: 'examples-cases',
				file: 'lists-valid-scenarios-with-capture-summaries.json'
			},
			[{ name: 'one valid working tree scenario', input: { root }, output: result }]
		);
	});
});

test('Shows one scenario with its requirements', async () => {
	await withTempRepo(async ({ root }) => {
		writeScenario(root);
		const result = await showScenario(scenario.id, root);
		expect(result.scenario.id).toBe(scenario.id);
		expect(result.required).toHaveLength(1);
		recordExampleCases(
			{
				unitId: 'workflow.inspect-scenarios',
				symbol: 'showScenario',
				state: 'shows-one-scenario-with-its-requirements',
				evidence: 'examples-cases',
				file: 'shows-one-scenario-with-its-requirements.json'
			},
			[
				{
					name: 'scenario with one required case state',
					input: { id: scenario.id, root },
					output: {
						scenario: result.scenario.id,
						required: result.required.length,
						unproven: result.unproven,
						excluded: result.excluded
					}
				}
			]
		);
	});
});

test('Checks scenarios and reports unknown units', async () => {
	await withTempRepo(async ({ root }) => {
		writeScenario(root);
		const result = await checkScenarios(root);
		expect(result.scenarios).toBe(1);
		expect(result.errors).toEqual([
			'inspect-scenarios.listing covers unknown unit workflow.inspect-scenarios'
		]);
		recordExampleCases(
			{
				unitId: 'workflow.inspect-scenarios',
				symbol: 'checkScenarios',
				state: 'checks-scenarios-and-reports-unknown-units',
				evidence: 'examples-cases',
				file: 'checks-scenarios-and-reports-unknown-units.json'
			},
			[
				{
					name: 'scenario manifest passes validation without unknown unit references',
					input: { root },
					output: { scenarios: result.scenarios, errors: result.errors, health: result.health }
				}
			]
		);
	});
});
