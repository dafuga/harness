import { resolve } from 'node:path';
import { spawnSync } from 'node:child_process';
import { mkdtempSync, readFileSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { expect, test } from 'vitest';
import { scenarioManifestSchema } from '../src/core/unitTypes';
import { scenarioRequirements } from '../src/utils/scenarioRequirements';
import manifest from '../specification/scenarios/shared-test-cases.json';
import unit from '../specification/units/desktop.component.workspace-shell.json';
import { verificationTarget } from './verification-targets';

test('shared case browser checks and recorded UI observations are required', () => {
	const scenario = scenarioManifestSchema.parse(manifest);
	const target = verificationTarget(
		'shared-test-cases',
		'playwright',
		'tests/e2e/ui-test-cases.spec.ts',
		resolve('packages/desktop')
	);
	expect(target?.states).toEqual([
		'component-current',
		'service-current',
		'page-current',
		'config-current',
		'component-commit'
	]);
	const { required } = scenarioRequirements(scenario);
	expect(required.filter((item) => item.kind === 'screenshot')).toHaveLength(7);
	expect(required.filter((item) => item.kind === 'trace')).toHaveLength(5);
	expect(scenario.units).toContain('desktop.component.workspace-shell');
	expect(unit.scenarios).toContain(scenario.id);
});

test('each required screen and trace is bound to the compiled renderer', () => {
	const scenario = scenarioManifestSchema.parse(manifest);
	for (const item of scenario.evidence.filter((item) =>
		['screenshot', 'trace'].includes(item.kind)
	)) {
		expect(item.required).toBe(true);
		expect(item.provenance).toBe('actual-capture');
		expect(item.build).toBe('desktop-renderer');
		if (item.kind === 'screenshot') expect(item.capture).toBe('full-page');
	}
});

test('the declared recorded-values command produces checked input and output examples', () => {
	const directory = mkdtempSync(resolve(tmpdir(), 'harness-readable-values-'));
	try {
		for (const id of ['recorded-values', 'readable-contracts']) {
			const check = manifest.tests.find((item) => item.id === id)!;
			const result = spawnSync('bun', check.target.split(' ').slice(1), {
				cwd: resolve(check.cwd),
				encoding: 'utf8',
				env: {
					...process.env,
					HARNESS_SCENARIO: manifest.id,
					HARNESS_EVIDENCE_DIR: directory,
					TAKE_SCREENSHOT: '1'
				}
			});
			expect(result.status, result.stderr).toBe(0);
		}
		const calls = JSON.parse(
			readFileSync(resolve(directory, 'readable-recorded-value-calls.json'), 'utf8')
		);
		expect(calls.unitId).toBe('reports.function.recorded-value');
		expect(calls.cases.map((item: { input: unknown }) => item.input)).toEqual([
			false,
			0,
			null,
			'false',
			[]
		]);
		expect(calls.cases[0].output).toEqual({ kind: 'scalar', type: 'Boolean', text: 'false' });
	} finally {
		rmSync(directory, { recursive: true, force: true });
	}
}, 20000);
