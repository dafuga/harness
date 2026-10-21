import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { expect, test } from 'vitest';
import { scenarioManifestSchema } from '../src/core/unitTypes';
import { scenarioRequirements } from '../src/utils/scenarioRequirements';
import { verifyPlan } from '../src/services/verification-service/verifyPlan';
import { defaultVerifyConfig } from '../src/core/verifyTypes';
import { defaultUnitsConfig } from '../src/core/unitsConfig';
import { verificationTarget } from './verification-targets';

const scenario = scenarioManifestSchema.parse(
	JSON.parse(readFileSync('specification/scenarios/desktop-renderer.json', 'utf8'))
);
const file = 'tests/e2e/ui-function-examples.spec.ts';
const needs = [
	['function-screens-desktop', 'function-card', 'desktop'],
	['function-screens-desktop', 'function-plan-legacy', 'desktop'],
	['function-screens-desktop', 'function-results-current', 'desktop'],
	['function-screens-desktop', 'function-results-commit', 'desktop'],
	['function-screens-tablet', 'function-results-current', 'tablet'],
	['function-screens-mobile', 'function-results-current', 'mobile']
];

test('clean verification runs the function UI and requires current, commit and legacy-plan evidence at every applicable width', () => {
	const plan = verifyPlan({
		selectedTests: [],
		scenarios: [scenario],
		config: defaultVerifyConfig,
		unitsConfig: defaultUnitsConfig
	});
	const checks = plan.filter((check) => check.command.includes(file));
	expect(checks).toHaveLength(1);
	expect(checks[0]).toMatchObject({
		command: 'bun ../../test/verification-output.ts playwright ' + file,
		cwd: 'packages/desktop'
	});
	expect(
		verificationTarget(scenario.id, 'playwright', file, resolve('packages/desktop')).states
	).toEqual(['function-examples-ui']);
	const required = scenarioRequirements(scenario).required.filter((need) =>
		need.evidence.startsWith('function-screens-')
	);
	expect(required.map((need) => [need.evidence, need.state, need.viewport])).toEqual(needs);
	const pictures = scenario.evidence.filter((item) => item.id.startsWith('function-screens-'));
	expect(pictures).toHaveLength(3);
	for (const picture of pictures)
		expect(picture).toMatchObject({
			kind: 'screenshot',
			provenance: 'actual-capture',
			build: 'desktop-renderer',
			capture: 'full-page',
			required: true
		});
});
