import {
	unitId,
	scenario,
	examplesCommand
} from './workflow.verification-evidence-run-verify-verify-plan-workflow.fixture';
import type { Cases } from './workflow.verification-evidence-run-verify-verify-plan-workflow.test.types';
import { existsSync, mkdirSync, writeFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { test } from 'vitest';
import { ExpectedCliError } from '../../src/core/development-tooling/errors';
import { verifyPlan } from '../../src/workflows/verification-evidence/run-verify/verifyPlanWorkflow';
import { recordExampleCases } from '../support/recordExampleCases';
import { withTempDir, withTempRepo } from '../support/temporary';
import type { TemporaryRepo } from '../support/temporary.types';
import { expect } from '../verificationExpect';
const scenarioFile = `specification/scenarios/examples-${unitId}.json`;
const selectionNote =
	'No locally cached passing base was provable without restoring evidence. Planned from an empty base; a run may restore proof and select fewer checks.';
const entityNote =
	'Entity planning uses the same scoped scenario selection as verify run --entity.';
const planned = ['test/alpha.test.ts', 'test/beta.test.ts'];
const sources = {
	'src/alpha.ts': 'export const alpha = 1;\n',
	'test/alpha.test.ts': "import { alpha } from '../src/alpha';\n\nexport const checked = alpha;\n",
	'test/beta.test.ts': 'export const beta = true;\n'
};
const scenarioText = `${JSON.stringify(scenario, null, '\t')}\n`;

/** Writes the files into the repository, commits them and returns the commit's full revision. */
function commit(repository: TemporaryRepo, files: Record<string, string>, message: string): string {
	for (const [path, text] of Object.entries(files)) {
		mkdirSync(dirname(join(repository.root, path)), { recursive: true });
		writeFileSync(join(repository.root, path), text);
	}
	repository.git('add', '--all');
	repository.git('-c', 'commit.gpgsign=false', 'commit', '-qm', message);
	return repository.git('rev-parse', 'HEAD');
}

/** The error a call rejected with, or undefined when the call resolved. */
function rejection(call: Promise<unknown>): Promise<Error | undefined> {
	return call.then(
		() => undefined,
		(error: Error) => error
	);
}

/** Records one state's cases; the state id is the test title as the scenario derivation names it. */
function recordCases(state: string, cases: Cases): void {
	recordExampleCases(
		{ unitId, symbol: 'verifyPlan', state, evidence: 'examples-cases', file: `${state}.json` },
		cases
	);
}

/** The source a full plan reports when it is planned from an empty base. */
function fullSource(head: string, requestedBase: string | null) {
	return {
		commit: head,
		base: null,
		requestedBase,
		runtime: 'module',
		scope: 'full',
		baseResolution: 'empty-conservative',
		selectionNote
	};
}

test('Root commit plans test files report-only from an empty base', async () => {
	await withTempRepo(async (repository) => {
		const head = commit(repository, sources, 'Add alpha and beta');
		const report = await verifyPlan({ root: repository.root, runtime: 'module' });
		expect(report.mode).toBe('report-only');
		expect(report.executedChecks).toBe(0);
		expect(report.source).toEqual(fullSource(head, null));
		expect(report.checks.map((check) => check.path)).toEqual(planned);
		expect(report.candidates.map((group) => group.checks.length)).toEqual([2]);
		expect(existsSync(join(repository.root, '.cache'))).toBe(false);
		recordCases('root-commit-plans-test-files-report-only-from-an-empty-base', [
			{
				name: 'a root commit of two test files, planned on the module runtime',
				input: { root: 'temporary directory', runtime: 'module' },
				output: report
			}
		]);
	});
});

test('Unproven first parent is requested but not used as the base', async () => {
	await withTempRepo(async (repository) => {
		const parent = commit(repository, sources, 'Add alpha and beta');
		const alphaChanged = { 'src/alpha.ts': 'export const alpha = 2;\n' };
		const head = commit(repository, alphaChanged, 'Change alpha');
		const parented = await verifyPlan({ root: repository.root, runtime: 'module' });
		const unbased = await verifyPlan({ root: repository.root, runtime: 'module', base: 'none' });
		expect(parented.source).toEqual(fullSource(head, parent));
		expect(unbased.source).toEqual(fullSource(head, null));
		// beta.test.ts is unchanged by the second commit, yet an empty base plans it as well.
		expect(parented.checks.map((check) => check.path)).toEqual(planned);
		expect(unbased.checks).toEqual(parented.checks);
		recordCases('unproven-first-parent-is-requested-but-not-used-as-the-base', [
			{
				name: 'first parent requested, with no passing local record to prove it',
				input: { root: 'temporary directory', runtime: 'module' },
				output: parented
			},
			{
				name: 'base none requests no revision and still plans from an empty base',
				input: { root: 'temporary directory', runtime: 'module', base: 'none' },
				output: unbased
			}
		]);
	});
});

test('Entity scope plans its covering scenario without any base', async () => {
	await withTempRepo(async (repository) => {
		const head = commit(repository, { [scenarioFile]: scenarioText }, 'Add the scenario');
		const report = await verifyPlan({ root: repository.root, runtime: 'module', entity: unitId });
		expect(report.source).toEqual({
			commit: head,
			base: null,
			requestedBase: null,
			runtime: 'module',
			scope: 'entity',
			entity: unitId,
			baseResolution: 'entity',
			selectionNote: entityNote
		});
		expect(report.checks.map((check) => [check.decision, check.command])).toEqual([
			['ineligible', examplesCommand]
		]);
		expect(report.candidates).toEqual([]);
		recordCases('entity-scope-plans-its-covering-scenario-without-any-base', [
			{
				name: 'an entity whose one scenario runs a command, planned with no base',
				input: { root: 'temporary directory', runtime: 'module', entity: unitId },
				output: report
			}
		]);
	});
});

test('Refuses a root, runtime, commit or entity it cannot plan', async () => {
	await withTempDir('verify-plan-plain-', async (plain) => {
		await withTempRepo(async (repository) => {
			commit(repository, sources, 'Add alpha and beta');
			const root = repository.root;
			const refusals = [
				[{ root: plain, runtime: 'module' }, 'harness verify needs a Git repository.'],
				[
					{ root, runtime: 'http' },
					'harness verify plan is local-only and cannot use the http impact runtime.'
				],
				[
					{ root, runtime: 'module', commit: 'refs/heads/missing' },
					'"refs/heads/missing" does not name a commit in this repository.'
				],
				[
					{ root, runtime: 'module', entity: 'workflow.not-covered' },
					'No scenario covers workflow.not-covered; nothing can be verified for it.'
				]
			] as const;
			const cases: Cases = [];
			for (const [options, message] of refusals) {
				const error = await rejection(verifyPlan(options));
				expect(error).toBeInstanceOf(ExpectedCliError);
				expect(error?.message).toBe(message);
				cases.push({
					name: `refused: ${message}`,
					input: { ...options, root: 'temporary directory' },
					error: { name: error?.name, message: error?.message }
				});
			}
			recordCases('refuses-a-root-runtime-commit-or-entity-it-cannot-plan', cases);
		});
	});
});

test('Rejects a verification config that is invalid or malformed', async () => {
	await withTempRepo(async (repository) => {
		const options = { root: repository.root, runtime: 'module' };
		const invalidConfig =
			'{"schemaVersion":1,"setup":[],"link":[],"runners":{"vitest":"bun x vitest run {target}"},"timeouts":{"test":0}}';
		const invalid = commit(
			repository,
			{ ...sources, 'harness.verify.json': `${invalidConfig}\n` },
			'Add an invalid verification config'
		);
		const malformed = commit(
			repository,
			{ 'harness.verify.json': '{"schemaVersion": 1,\n' },
			'Add a malformed verification config'
		);
		const schemaError = await rejection(verifyPlan({ ...options, commit: invalid }));
		const syntaxError = await rejection(verifyPlan({ ...options, commit: malformed }));
		expect(schemaError).toBeInstanceOf(ExpectedCliError);
		expect(schemaError?.message).toMatch(/^harness\.verify\.json is invalid: timeouts\.test /);
		expect(syntaxError?.name).toBe('SyntaxError');
		recordCases('rejects-a-verification-config-that-is-invalid-or-malformed', [
			{
				name: 'a config that parses but fails schema validation',
				input: { root: 'temporary directory', runtime: 'module', commit: invalid },
				error: { name: schemaError?.name, message: schemaError?.message }
			},
			{
				name: 'a config that is not valid JSON, read from the commit tree',
				input: { root: 'temporary directory', runtime: 'module', commit: malformed },
				error: { name: syntaxError?.name, message: syntaxError?.message }
			}
		]);
	});
});
