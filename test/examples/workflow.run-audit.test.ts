import { mkdirSync, writeFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { test, vi } from 'vitest';
import { runAudit } from '../../src/cli/program/runAudit';
import type { AuditCommandOptions } from '../../src/cli/program/runAudit.types';
import { recordExampleCases } from '../support/recordExampleCases';
import { withTempDir } from '../support/temporary';
import { expect } from '../verificationExpect';

const recordMeta = { unitId: 'workflow.run-audit', symbol: 'runAudit', evidence: 'examples-cases' };
const cleanIndex = 'export function shout(text: string): string {\n\treturn text.toUpperCase();\n}\n';
// 240 constants push src/index.ts past the 220-line limit: the audit reports one small-file finding.
const oversizedIndex = Array.from(
	{ length: 240 },
	(_, index) => `export const limit${index} = ${index};\n`
).join('');
const releaseLoop = JSON.stringify({
	name: 'release-loop',
	goal: 'Publish the release notes',
	createdAt: '2026-11-14T09:00:00.000Z',
	updatedAt: '2026-11-14T09:00:00.000Z',
	steps: [{ id: 'write-notes', title: 'Write the release notes', status: 'pending' }]
});
// Analytics stay off and the ambient defaults are blanked, so only the fixture decides results.
const isolatedEnvironment = {
	HARNESS_ANALYTICS_DISABLED: '1',
	HARNESS_ANALYTICS_LOOP: '',
	HARNESS_ANALYTICS_REPORT: '',
	HARNESS_ANALYTICS_STEP: '',
	HARNESS_ANALYTICS_TASK: ''
};
// A fake git that reports nothing as ignored: a clean-code review never reaches a real repository.
const fakeGit = '#!/bin/sh\ncat > /dev/null\nexit 1\n';

function writeFiles(root: string, files: Record<string, string>): void {
	for (const [path, contents] of Object.entries(files)) {
		mkdirSync(dirname(join(root, path)), { recursive: true });
		writeFileSync(join(root, path), contents);
	}
}

/** Runs one state in its own temporary folders, with PATH and the report home confined to them. */
async function withSandbox(use: (sandbox: { root: string; reports: string }) => Promise<void>) {
	await withTempDir('run-audit-', async (directory) => {
		const bin = join(directory, 'bin');
		mkdirSync(bin);
		writeFileSync(join(bin, 'git'), fakeGit, { mode: 0o700 });
		const sandbox = { root: join(directory, 'project'), reports: join(directory, 'reports') };
		const env = { ...isolatedEnvironment, PATH: bin, PROJECT_REPORTS_HOME: sandbox.reports };
		for (const [name, value] of Object.entries(env)) vi.stubEnv(name, value);
		try {
			await use(sandbox);
		} finally {
			vi.unstubAllEnvs();
		}
	});
}

/** Captures what runAudit prints and the exit status it sets, then restores both. */
async function runCaptured(root: string, options: AuditCommandOptions) {
	const log = vi.spyOn(console, 'log').mockImplementation(() => undefined);
	const previous = process.exitCode;
	process.exitCode = undefined;
	try {
		await runAudit(root, options);
		return { printed: String(log.mock.calls[0]?.[0]), exitCode: process.exitCode };
	} finally {
		log.mockRestore();
		process.exitCode = previous;
	}
}

/** Resolves to the error that runAudit rejects with, or to undefined when it resolves. */
async function failureOf(run: () => Promise<void>) {
	try {
		await run();
		return undefined;
	} catch (error) {
		const { name, message, code } = error as Error & { code?: string };
		return { name, message, code };
	}
}

test('Prints the coverage view for an audit', async () => {
	await withSandbox(async ({ root }) => {
		writeFiles(root, { 'src/index.ts': cleanIndex });
		const explicit = await runCaptured(root, { profile: 'auto', coverage: true });
		const omitted = await runCaptured(root, { coverage: true });
		expect(explicit.printed).toContain('Harness audit passed');
		expect(explicit.printed).toContain('Harness audit coverage (lib profile)');
		expect(explicit.printed).toContain('- typescript: 1 files');
		expect(explicit.exitCode).toBe(0);
		expect(omitted).toEqual(explicit);
		const state = 'prints-the-coverage-view-for-an-audit';
		recordExampleCases({ ...recordMeta, state, file: `${state}.json` }, [
			{ name: 'profile auto', input: { profile: 'auto', coverage: true }, output: explicit },
			{ name: 'profile omitted', input: { coverage: true }, output: omitted }
		]);
	});
});

test('Prints the audit as JSON and exits 1 for findings', async () => {
	await withSandbox(async ({ root }) => {
		writeFiles(root, { 'src/index.ts': oversizedIndex });
		const run = await runCaptured(root, { profile: 'lib', json: true, coverage: true });
		const result = JSON.parse(run.printed) as {
			coverage: { profile: string };
			findings: Array<{ path: string; rule: string }>;
		};
		const output = {
			coverageProfile: result.coverage.profile,
			findings: result.findings.map(({ path, rule }) => ({ path, rule })),
			exitCode: run.exitCode
		};
		expect(run.printed.startsWith('{')).toBe(true);
		expect(output).toEqual({
			coverageProfile: 'lib',
			findings: [{ path: 'src/index.ts', rule: 'small-file' }],
			exitCode: 1
		});
		const state = 'prints-the-audit-as-json-and-exits-1-for-findings';
		recordExampleCases({ ...recordMeta, state, file: `${state}.json` }, [
			{
				name: 'json over coverage, one oversized file',
				input: { profile: 'lib', json: true, coverage: true },
				output
			}
		]);
	});
});

test('Reports a dry-run clean-code review', async () => {
	await withSandbox(async ({ root, reports }) => {
		writeFiles(root, { 'src/index.ts': cleanIndex });
		writeFiles(reports, { 'runs/release-2026-11-14/manifest.json': '{"schemaVersion":1}\n' });
		const input = {
			report: 'release-2026-11-14',
			agentModel: 'claude-sonnet-5-5',
			cleanCode: true,
			dryRun: true
		};
		const run = await runCaptured(root, input);
		expect(run.printed).toContain('Clean Code review (advisory): dry-run');
		expect(run.printed).toContain('planned: src/index.ts');
		expect(run.exitCode).toBe(0);
		const state = 'reports-a-dry-run-clean-code-review';
		recordExampleCases({ ...recordMeta, state, file: `${state}.json` }, [
			{ name: 'release report with a dry-run review', input, output: run }
		]);
	});
});

test('Rejects an unsupported audit profile', async () => {
	await withSandbox(async ({ root }) => {
		writeFiles(root, { 'src/index.ts': cleanIndex });
		const monorepo = await failureOf(() => runAudit(root, { profile: 'monorepo' }));
		const uppercase = await failureOf(() => runAudit(root, { profile: 'APP' }));
		expect(monorepo).toEqual({
			name: 'ExpectedCliError',
			message: 'Unsupported audit profile "monorepo". Use one of: auto, app, dapp, lib.'
		});
		expect(uppercase?.message).toContain('"APP"');
		const state = 'rejects-an-unsupported-audit-profile';
		recordExampleCases({ ...recordMeta, state, file: `${state}.json` }, [
			{ name: 'profile outside the list', input: { profile: 'monorepo' }, error: monorepo },
			{ name: 'profile names are case sensitive', input: { profile: 'APP' }, error: uppercase }
		]);
	});
});

test('Checks loop and step options against the loop state', async () => {
	await withSandbox(async ({ root }) => {
		const loop = 'release-loop';
		writeFiles(root, {
			'src/index.ts': cleanIndex,
			[`specification/loops/${loop}/loop.json`]: releaseLoop
		});
		const taskWithLoop = await failureOf(() => runAudit(root, { task: 'task-7', loop }));
		const stepWithoutLoop = await failureOf(() => runAudit(root, { step: 'write-notes' }));
		const unknownStep = await failureOf(() => runAudit(root, { loop, step: 'publish' }));
		const accepted = await runCaptured(root, { loop, step: 'write-notes' });
		expect(taskWithLoop?.message).toBe('Use either --task or --loop/--step.');
		expect(stepWithoutLoop?.message).toBe('--step requires --loop.');
		expect(unknownStep?.message).toBe('Loop step does not exist.');
		expect(accepted.printed).toContain('Harness audit passed');
		const state = 'checks-loop-and-step-options-against-the-loop-state';
		recordExampleCases({ ...recordMeta, state, file: `${state}.json` }, [
			{ name: 'task with a loop', input: { task: 'task-7', loop }, error: taskWithLoop },
			{ name: 'step without a loop', input: { step: 'write-notes' }, error: stepWithoutLoop },
			{ name: 'step missing from the loop', input: { loop, step: 'publish' }, error: unknownStep },
			{ name: 'existing loop step', input: { loop, step: 'write-notes' }, output: accepted }
		]);
	});
});

test('Rejects an invalid report ID or a missing manifest', async () => {
	await withSandbox(async ({ root }) => {
		writeFiles(root, { 'src/index.ts': cleanIndex });
		const invalid = await failureOf(() => runAudit(root, { report: '../escape' }));
		const missing = await failureOf(() => runAudit(root, { report: 'missing-report' }));
		expect(invalid?.message).toBe('Invalid report ID.');
		expect(missing?.code).toBe('ENOENT');
		expect(missing?.message).toContain('manifest.json');
		const state = 'rejects-an-invalid-report-id-or-a-missing-manifest';
		recordExampleCases({ ...recordMeta, state, file: `${state}.json` }, [
			{ name: 'report ID with path characters', input: { report: '../escape' }, error: invalid },
			{
				name: 'report without a runs manifest',
				input: { report: 'missing-report' },
				error: { name: missing?.name, code: missing?.code }
			}
		]);
	});
});
