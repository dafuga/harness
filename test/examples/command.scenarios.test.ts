import type { ExampleCase, Invocation, ScenarioSummary, CheckResult } from './command.scenarios.test.types';
import { mkdirSync, writeFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { Command } from 'commander';
import { test, vi } from 'vitest';
import { registerScenariosCommand } from '../../src/cli/program/ScenariosCommand';
import { withTempDir } from '../support/temporary';
import { recordExampleCases } from '../support/recordExampleCases';
import { expect } from '../verificationExpect';

function record(state: string, cases: ExampleCase[]): void {
	recordExampleCases(
		{
			unitId: 'command.scenarios',
			symbol: 'registerScenariosCommand',
			state,
			evidence: 'examples-cases',
			file: `${state}.json`
		},
		cases
	);
}

function unit(id: string) {
	const source = `src/${id.replaceAll('.', '/')}.ts`;
	return {
		schemaVersion: 1,
		id,
		kind: id.split('.')[0],
		title: id,
		responsibility: `Describes ${id} for a temporary scenario workspace.`,
		responsibilityOrigin: 'declared',
		status: 'active',
		owns: { source: [source], symbols: [] },
		contract: { origin: 'declared', inputs: [], outputs: [], errors: [] },
		dependencies: [],
		runtime: { kind: 'module', entry: source, targets: [{ kind: 'module', entry: source }] },
		scenarios: [],
		budgets: { size: 'frozen', complexity: 'frozen', performance: [] }
	};
}

function scenario(id: string, units = ['command.scenarios']) {
	return {
		schemaVersion: 1,
		id,
		title: `Scenario ${id}`,
		kind: 'headless',
		units,
		states: [
			{ id: 'ready', title: 'Ready', coverage: 'required' },
			{
				id: 'waiting',
				title: 'Waiting for evidence',
				coverage: 'missing',
				reason: 'No proof has been recorded yet.'
			}
		],
		viewports: [],
		tests: [
			{
				id: 'scenario-command',
				kind: 'unit',
				runner: 'vitest',
				target: 'test/examples/command.scenarios.test.ts'
			}
		],
		evidence: [
			{ id: 'assertions', kind: 'assertions', states: ['ready'], viewports: [], required: true }
		]
	};
}

function writeJson(root: string, path: string, value: unknown): void {
	mkdirSync(dirname(join(root, path)), { recursive: true });
	writeFileSync(join(root, path), JSON.stringify(value, null, 2));
}

function workspace(root: string, scenarios: ReturnType<typeof scenario>[], units: string[]): void {
	for (const id of units) writeJson(root, `specification/units/${id}.json`, unit(id));
	for (const manifest of scenarios)
		writeJson(root, `specification/scenarios/${manifest.id}.json`, manifest);
}

async function dispatch(root: string, argv: string[]): Promise<Invocation> {
	const previous = process.cwd();
	const stdout: string[] = [];
	process.chdir(root);
	const log = vi.spyOn(console, 'log').mockImplementation((...values) => {
		stdout.push(values.map(String).join(' '));
	});
	try {
		const program = new Command().name('harness').exitOverride();
		registerScenariosCommand(program);
		await program.parseAsync(argv, { from: 'user' });
		return { stdout };
	} catch (error) {
		return { stdout, error };
	} finally {
		log.mockRestore();
		process.chdir(previous);
	}
}

function json<T>(invocation: Invocation): T {
	return JSON.parse(invocation.stdout[0]) as T;
}

function errorSummary(error: unknown): { name: string; message: string } {
	if (error instanceof Error) return { name: error.name, message: error.message };
	return { name: typeof error, message: String(error) };
}

test('lists scenarios with capture summaries', async () => {
	await withTempDir('scenarios-list-examples-', async (root) => {
		workspace(root, [scenario('zeta'), scenario('alpha')], ['command.scenarios']);
		const invocation = await dispatch(root, ['scenarios', 'list', '--json']);
		const listed = json<ScenarioSummary[]>(invocation);
		expect(invocation.error).toBeUndefined();
		expect(listed.map(({ id }) => id)).toEqual(['alpha', 'zeta']);
		expect(listed[0]).toMatchObject({ captures: 1, unproven: 1, excluded: 0 });
		record('lists-scenarios-with-capture-summaries', [
			{
				name: 'lists two headless scenario manifests in id order',
				input: {
					program: 'harness',
					argv: ['scenarios', 'list', '--json'],
					scenarios: ['zeta', 'alpha']
				},
				output: listed
			}
		]);
	});
});

test('shows required captures and rejects an unknown scenario', async () => {
	await withTempDir('scenarios-show-examples-', async (root) => {
		workspace(root, [scenario('alpha')], ['command.scenarios']);
		const shown = await dispatch(root, ['scenarios', 'show', 'alpha', '--json']);
		const result = json<{
			scenario: { id: string };
			required: Array<{ evidence: string; kind: string; state: string }>;
			unproven: Array<{ state: string; reason: string }>;
		}>(shown);
		const missing = await dispatch(root, ['scenarios', 'show', 'missing', '--json']);
		const missingError = errorSummary(missing.error);
		expect(shown.error).toBeUndefined();
		expect(result).toMatchObject({
			scenario: { id: 'alpha' },
			required: [{ evidence: 'assertions', kind: 'assertions', state: 'ready' }],
			unproven: [{ state: 'waiting', reason: 'No proof has been recorded yet.' }]
		});
		expect(missingError).toEqual({
			name: 'ExpectedCliError',
			message: 'Unknown scenario "missing".'
		});
		record('shows-required-captures-and-rejects-an-unknown-scenario', [
			{
				name: 'shows required evidence for a known scenario',
				input: { program: 'harness', argv: ['scenarios', 'show', 'alpha', '--json'] },
				output: result
			},
			{
				name: 'rejects an id with no matching scenario',
				input: { program: 'harness', argv: ['scenarios', 'show', 'missing', '--json'] },
				error: missingError
			}
		]);
	});
});

test('checks errors while keeping coverage diagnostics report-only', async () => {
	const good = await withTempDir('scenarios-check-examples-', async (root) => {
		workspace(root, [scenario('alpha')], ['command.scenarios', 'service.orphan']);
		const invocation = await dispatch(root, ['scenarios', 'check', '--json']);
		return { invocation, result: json<CheckResult>(invocation) };
	});
	const bad = await withTempDir('scenarios-check-examples-', async (root) => {
		workspace(
			root,
			[scenario('alpha', ['command.scenarios', 'function.missing'])],
			['command.scenarios']
		);
		const invocation = await dispatch(root, ['scenarios', 'check', '--json']);
		return { invocation, result: json<{ errors: string[] }>(invocation) };
	});
	const badError = errorSummary(bad.invocation.error);
	expect(good.invocation.error).toBeUndefined();
	expect(good.result.errors).toEqual([]);
	expect(good.result.health.coverage.missing).toBe(1);
	expect(good.result.health.noScenario.total).toBe(1);
	expect(badError).toEqual({
		name: 'ExpectedCliError',
		message: 'alpha covers unknown unit function.missing'
	});
	expect(bad.result.errors).toEqual(['alpha covers unknown unit function.missing']);
	record('checks-errors-while-keeping-coverage-diagnostics-report-only', [
		{
			name: 'keeps missing state and uncovered unit diagnostics out of errors',
			input: { argv: ['scenarios', 'check', '--json'], scenarios: ['alpha'] },
			output: good.result
		},
		{
			name: 'fails when a scenario names an unregistered unit',
			input: {
				argv: ['scenarios', 'check', '--json'],
				scenarioUnits: ['command.scenarios', 'function.missing']
			},
			error: { ...badError, printedErrors: bad.result.errors }
		}
	]);
});
