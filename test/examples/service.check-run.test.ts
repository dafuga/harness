import { readFile } from 'node:fs/promises';
import { join } from 'node:path';
import { test } from 'vitest';
import { expect } from '../verificationExpect';
import { recordExampleCases } from '../support/recordExampleCases';
import { withTempDir } from '../support/temporary';
import { CheckRunService, type RunContext } from '../../src/services/CheckRunService';
import type { PlannedCheck } from '../../src/utils/verification-evidence/verifyPlan';

const COMMIT = '0123456789abcdef0123456789abcdef01234567';
const TREE = '89abcdef0123456789abcdef0123456789abcdef';
const SCOPED_COMMAND =
	'printf "%s %s %s" "$HARNESS_SCENARIO" "$HARNESS_VERIFY_REVISION" "$HARNESS_EVIDENCE_DIR"; exit 4';

/** A context whose resource admission uses a scratch queue home and no inherited lease. */
function contextFor(directory: string, env: Record<string, string | undefined> = {}): RunContext {
	return {
		snapshot: directory,
		directory,
		commit: COMMIT,
		tree: TREE,
		profile: 'ci',
		env: {
			PATH: process.env.PATH,
			HARNESS_RESOURCES_HOME: join(directory, 'resources'),
			HARNESS_RESOURCE_LEASE: undefined,
			HARNESS_VERIFY_ENTITY: undefined,
			...env
		}
	};
}

function plannedCheck(overrides: Partial<PlannedCheck> & { command: string }): PlannedCheck {
	return {
		id: 'src/services/CheckRunService.test.ts',
		name: 'CheckRunService',
		kind: 'unit',
		runner: 'command',
		target: 'module',
		cwd: '.',
		timeoutMs: 30_000,
		...overrides
	};
}

test('Runs a passing check and records its log entry', () =>
	withTempDir('check-run-pass-', async (directory) => {
		const service = new CheckRunService(contextFor(directory));
		const outcome = await service.run(plannedCheck({ command: 'printf passed' }));
		expect(outcome.passed).toBe(true);
		expect(outcome.failures).toEqual([]);
		expect(outcome.gathered).toEqual([]);
		expect(outcome.entry.status).toBe('passed');
		const log = await readFile(join(directory, outcome.entry.log.path), 'utf8');
		expect(log).toBe('passed');
		recordExampleCases(
			{
				unitId: 'service.check-run',
				symbol: 'CheckRunService.run',
				state: 'runs-a-passing-check-and-records-its-log-entry',
				evidence: 'examples-cases',
				file: 'runs-a-passing-check-and-records-its-log-entry.json'
			},
			[
				{
					name: 'printf passed runs in the snapshot and records a passed entry',
					input: { command: 'printf passed', timeoutMs: 30_000 },
					output: {
						passed: outcome.passed,
						failures: outcome.failures,
						gathered: outcome.gathered,
						entry: outcome.entry,
						log
					}
				}
			]
		);
	}));

test('Fails a check that exits nonzero with its exit code', () =>
	withTempDir('check-run-exit-', async (directory) => {
		const service = new CheckRunService(contextFor(directory));
		const outcome = await service.run(plannedCheck({ command: 'exit 4' }));
		expect(outcome.passed).toBe(false);
		expect(outcome.entry.status).toBe('failed');
		expect(outcome.failures).toEqual(['test CheckRunService failed with exit code 4']);
		recordExampleCases(
			{
				unitId: 'service.check-run',
				symbol: 'CheckRunService.run',
				state: 'fails-a-check-that-exits-nonzero-with-its-exit-code',
				evidence: 'examples-cases',
				file: 'fails-a-check-that-exits-nonzero-with-its-exit-code.json'
			},
			[
				{
					name: 'exit 4 yields a failed entry and the exit code as its only failure',
					input: { command: 'exit 4' },
					output: {
						passed: outcome.passed,
						failures: outcome.failures,
						status: outcome.entry.status
					}
				}
			]
		);
	}));

test('Scopes evidence to the scenario and prefixes its failures', () =>
	withTempDir('check-run-scenario-', async (directory) => {
		const service = new CheckRunService(contextFor(directory));
		const check = plannedCheck({
			id: 'checkout:checkout-form',
			scenario: 'checkout',
			name: 'checkout-form',
			command: SCOPED_COMMAND
		});
		const outcome = await service.run(check);
		expect(outcome.failures).toEqual(['checkout: test checkout-form failed with exit code 4']);
		const printed = await readFile(join(directory, outcome.entry.log.path), 'utf8');
		const evidence = printed.replace(directory, '<scratch>');
		expect(evidence).toBe(`checkout ${COMMIT} <scratch>/evidence/${COMMIT}/checkout/checkout-form`);
		recordExampleCases(
			{
				unitId: 'service.check-run',
				symbol: 'CheckRunService.run',
				state: 'scopes-evidence-to-the-scenario-and-prefixes-its-failures',
				evidence: 'examples-cases',
				file: 'scopes-evidence-to-the-scenario-and-prefixes-its-failures.json'
			},
			[
				{
					name: 'scenario checkout exports its scope and prefixes the exit failure',
					input: {
						scenario: 'checkout',
						name: 'checkout-form',
						command: SCOPED_COMMAND
					},
					output: { failures: outcome.failures, printed: evidence }
				}
			]
		);
	}));

test('Returns the first printed line of a passing tool', () =>
	withTempDir('check-run-version-', async (directory) => {
		const service = new CheckRunService(contextFor(directory));
		const version = await service.version({
			id: 'node',
			command: 'printf "\\n   v22.11.0  \\nextra line\\n"'
		});
		expect(version).toBe('v22.11.0');
		recordExampleCases(
			{
				unitId: 'service.check-run',
				symbol: 'CheckRunService.version',
				state: 'returns-the-first-printed-line-of-a-passing-tool',
				evidence: 'examples-cases',
				file: 'returns-the-first-printed-line-of-a-passing-tool.json'
			},
			[
				{
					name: 'blank lines are skipped and the first nonempty line is trimmed',
					input: { id: 'node', command: 'printf "\\n   v22.11.0  \\nextra line\\n"' },
					output: version ?? null
				}
			]
		);
	}));

test('Returns undefined for a tool command that fails', () =>
	withTempDir('check-run-tool-fail-', async (directory) => {
		const service = new CheckRunService(contextFor(directory));
		const version = await service.version({ id: 'node', command: 'printf v1; exit 2' });
		expect(version).toBeUndefined();
		recordExampleCases(
			{
				unitId: 'service.check-run',
				symbol: 'CheckRunService.version',
				state: 'returns-undefined-for-a-tool-command-that-fails',
				evidence: 'examples-cases',
				file: 'returns-undefined-for-a-tool-command-that-fails.json'
			},
			[
				{
					name: 'a tool exiting 2 after printing yields no version',
					input: { id: 'node', command: 'printf v1; exit 2' },
					output: version ?? null
				}
			]
		);
	}));

test('Rejects a resource priority outside the known values with ZodError', () =>
	withTempDir('check-run-priority-', async (directory) => {
		const service = new CheckRunService(
			contextFor(directory, { HARNESS_RESOURCE_PRIORITY: 'urgent' })
		);
		const failure = await service.run(plannedCheck({ command: 'printf passed' })).then(
			() => undefined,
			(error: Error) => ({ name: error.name })
		);
		expect(failure?.name).toBe('ZodError');
		recordExampleCases(
			{
				unitId: 'service.check-run',
				symbol: 'CheckRunService.run',
				state: 'rejects-a-resource-priority-outside-the-known-values-with-zoderror',
				evidence: 'examples-cases',
				file: 'rejects-a-resource-priority-outside-the-known-values-with-zoderror.json'
			},
			[
				{
					name: 'an unknown HARNESS_RESOURCE_PRIORITY rejects before any check starts',
					input: { HARNESS_RESOURCE_PRIORITY: 'urgent' },
					error: failure?.name ?? null
				}
			]
		);
	}));
