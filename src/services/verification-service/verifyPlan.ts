import type { PlanInput, PlannedCheck } from '../../utils/verifyPlan';
import { posix } from 'node:path';
import { defaultVerifyConfig } from '../../core/verifyTypes';
import { classifyPath } from '../../utils/classify-path/classifyPath';

/** Every check a verification runs: selected test files, then the checks of each scenario. */
export function verifyPlan(input: PlanInput): PlannedCheck[] {
	const timeoutMs = input.testTimeoutMs ?? input.config.timeouts.test;
	const command = (runner: PlannedCheck['runner'], target: string) =>
		runner === 'command'
			? target
			: (input.config.runners[runner] ?? defaultVerifyConfig.runners[runner]).replace(
					'{target}',
					target
				);
	const scenarioChecks = input.scenarios.flatMap((scenario) =>
		scenario.tests.map(
			(test): PlannedCheck => ({
				id: `${scenario.id}:${test.id}`,
				scenario: scenario.id,
				name: test.id,
				kind: test.kind,
				runner: test.runner,
				target: test.target,
				cwd: test.cwd ?? '.',
				command: command(test.runner, test.target),
				timeoutMs: test.timeoutMs ?? timeoutMs
			})
		)
	);
	const covered = new Set(scenarioChecks.map((check) => posix.join(check.cwd, check.target)));
	const fileChecks = input.selectedTests
		.filter((path) => !covered.has(path))
		.sort()
		.map((path) => fileCheck(path, input, { command, timeoutMs }));
	const byTarget = (left: PlannedCheck, right: PlannedCheck) =>
		left.target < right.target ? -1 : 1;
	return [...fileChecks, ...scenarioChecks.sort(byTarget)];
}

/** The check of one selected test file: its own declared command, or the runner its name implies. */
function fileCheck(
	path: string,
	input: PlanInput,
	defaults: {
		command: (runner: PlannedCheck['runner'], target: string) => string;
		timeoutMs: number;
	}
): PlannedCheck {
	const placed = classifyPath(path, input.unitsConfig);
	const runner = /\.spec\.[cm]?[jt]sx?$/.test(path) ? 'playwright' : 'vitest';
	// A file may declare its own command, such as another configuration of its runner.
	const own = input.config.checks.find((check) => check.path === path);
	return {
		id: path,
		name: path,
		kind: /\.e2e\.|tests\/e2e\//.test(path) ? 'e2e' : 'unit',
		runner,
		target: path,
		cwd: placed.workspaceRoot,
		command: own
			? own.command.replace('{target}', placed.relative)
			: defaults.command(runner, placed.relative),
		timeoutMs: own?.timeoutMs ?? defaults.timeoutMs
	};
}
