import { Command } from 'commander';
import { registerVerifyCommand } from '../../src/cli/program/VerifyCommand';
import { verifyPlanReport } from '../../src/workflows/verification-evidence/run-verify/verification-service/verifyPlanReport';
import { VerificationService } from '../../src/workflows/verification-evidence/run-verify/verification-service/VerificationService';
import { defaultVerifyConfig } from '../../src/core/verification-evidence/verifyTypes';
import type { ImpactReport } from '../../src/core/development-tooling/impactTypes';
import { emptySide } from '../../src/workflows/development-tooling/loadRevisions';
import { defaultUnitsConfig } from '../../src/core/development-tooling/unitsConfig';
import type { PlannedCheck } from '../../src/utils/verification-evidence/verifyPlan';
import { expect, test } from 'vitest';

function check(
	overrides: Partial<PlannedCheck> & Pick<PlannedCheck, 'id' | 'target'>
): PlannedCheck {
	return {
		name: overrides.id,
		kind: 'unit',
		runner: 'vitest',
		cwd: 'packages/planning',
		command: `bun x vitest run ${overrides.target.replace('packages/planning/', '')}`,
		timeoutMs: 180_000,
		...overrides
	};
}

function groupingPlan(): PlannedCheck[] {
	return [
		check({ id: 'planning:a', target: 'packages/planning/test/a.test.ts' }),
		check({ id: 'planning:b', target: 'packages/planning/test/b.test.ts' }),
		check({
			id: 'planning:slow',
			target: 'packages/planning/test/slow.test.ts',
			timeoutMs: 240_000
		}),
		check({
			id: 'desktop:a',
			target: 'packages/desktop/test/a.test.ts',
			cwd: 'packages/desktop',
			command: 'bun x vitest run test/a.test.ts'
		}),
		check({
			id: 'picker',
			target: 'packages/reports/tests/e2e/provider-picker.spec.ts',
			runner: 'playwright',
			cwd: 'packages/reports',
			command: 'bun x playwright test --config src/configs/pickerPlaywrightConfig.ts'
		}),
		check({
			id: 'wrong-runner',
			target: 'packages/planning/test/wrong.test.ts',
			command: 'bun x playwright test test/wrong.test.ts'
		})
	];
}

test('verification plan registration exposes a report-only plan subcommand', () => {
	const program = new Command();
	registerVerifyCommand(program);
	expect(program.commands[0]?.commands.map((command) => command.name())).toEqual([
		'run',
		'plan',
		'check',
		'identity',
		'stamp'
	]);
});

test('VerificationService.plan returns the same selected file plan used by run', () => {
	const head = { ...emptySide(), revision: 'commit-head', config: defaultUnitsConfig };
	const impact = {
		base: 'none',
		head: 'commit-head',
		runtime: 'module',
		expanded: false,
		changed: [],
		units: { direct: [], indirect: [], added: [], removed: [] },
		tests: { selected: ['test/selected.test.ts'], excluded: [], removed: [] },
		scenarios: { affected: [], unaffected: [] },
		uncertain: []
	} satisfies ImpactReport;
	const service = new VerificationService({
		root: process.cwd(),
		commit: 'commit-head',
		tree: 'tree-head',
		baseCommit: null,
		requestedBase: null,
		base: emptySide(),
		head,
		impact,
		config: defaultVerifyConfig,
		env: {},
		explained: async () => ({ required: [], entries: [], overlong: [], failures: [] })
	});
	expect(service.plan().map(({ id, command, timeoutMs }) => ({ id, command, timeoutMs }))).toEqual([
		{
			id: 'test/selected.test.ts',
			command: 'bun x vitest run test/selected.test.ts',
			timeoutMs: 600_000
		}
	]);
});

test('grouping candidates require exact runner, command template, cwd, and timeout matches', () => {
	const plan = groupingPlan();
	const report = verifyPlanReport(plan, {
		commit: 'abc123',
		base: null,
		requestedBase: null,
		runtime: 'module',
		scope: 'full',
		baseResolution: 'local-cache',
		selectionNote: 'Uses locally proven base.'
	});

	expect(report.mode).toBe('report-only');
	expect(report.executedChecks).toBe(0);
	expect(report.plannedChecks).toBe(plan.length);
	expect(report.candidates).toEqual([
		{
			id: 'candidate-001',
			runner: 'vitest',
			cwd: 'packages/planning',
			commandTemplate: 'bun x vitest run {target}',
			timeoutMs: 180_000,
			checks: [
				{ id: 'planning:a', path: 'packages/planning/test/a.test.ts' },
				{ id: 'planning:b', path: 'packages/planning/test/b.test.ts' }
			]
		}
	]);
	expect(report.checks.map(({ id, path }) => ({ id, path }))).toEqual(
		plan.map(({ id, target }) => ({ id, path: target }))
	);
	expect(report.checks.map(({ id, decision }) => [id, decision])).toEqual([
		['planning:a', 'candidate'],
		['planning:b', 'candidate'],
		['planning:slow', 'singleton'],
		['desktop:a', 'singleton'],
		['picker', 'ineligible'],
		['wrong-runner', 'ineligible']
	]);
	expect(report.singletons).toBe(2);
	expect(report.ineligible).toBe(2);
	expect(verifyPlanReport(plan, report.source)).toEqual(report);
});

test('basename-only test arguments stay ungrouped unless the target path is exact', () => {
	const report = verifyPlanReport(
		[
			check({
				id: 'shell:a',
				target: 'packages/reports/tests/e2e/explorer-shell.spec.ts',
				cwd: 'packages/reports',
				command: 'bun x playwright test --config shellPlaywrightConfig.ts explorer-shell.spec.ts',
				runner: 'playwright'
			})
		],
		{
			commit: 'abc123',
			base: null,
			requestedBase: null,
			runtime: 'module',
			scope: 'full',
			baseResolution: 'empty-conservative',
			selectionNote: 'No local trusted base.'
		}
	);
	expect(report.ineligible).toBe(1);
	expect(report.checks[0]?.reason).toContain('Could not prove');
});
