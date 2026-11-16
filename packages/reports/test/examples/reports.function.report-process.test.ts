import { mkdtempSync, realpathSync, rmSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { test } from 'vitest';
import { expect } from '../../../../test/verificationExpect';
import { recordExampleCases } from '../../../../test/support/recordExampleCases';
import { reportProcess } from '../../src/utils/reports-media/reportProcess';

const UNIT_ID = 'reports.function.report-process';
const FAKE_REPORT = `
const mode = process.argv[2];
if (mode === 'large') process.stdout.write('x'.repeat(2100000) + 'END');
else if (mode === 'env') console.log(process.cwd() + ' ' + process.env.REPORT_OUTPUT_FORMAT);
else if (mode === 'fail') { console.log('Invalid report configuration'); process.exit(1); }
else { console.log('Report completed'); console.error('warning'); }
`;

type Cases = Parameters<typeof recordExampleCases>[1];

function makeFixture(): { dir: string; script: string } {
	const dir = mkdtempSync(join(tmpdir(), 'report-process-'));
	const script = join(dir, 'fake-report.cjs');
	writeFileSync(script, FAKE_REPORT);
	return { dir, script };
}

function record(state: string, cases: Cases): void {
	recordExampleCases(
		{
			unitId: UNIT_ID,
			symbol: 'reportProcess',
			state,
			evidence: 'examples-cases',
			file: `${state}.json`
		},
		cases
	);
}

test('Runs a successful command and captures its output', async () => {
	const fixture = makeFixture();
	try {
		const result = await reportProcess(process.execPath, [fixture.script, 'success'], fixture.dir);
		expect(result.code).toBe(0);
		expect(result.output).toContain('Report completed');
		expect(result.output).toContain('warning');
		expect(result.durationMs).toBeGreaterThanOrEqual(0);
		record('runs-a-successful-command-and-captures-its-output', [
			{
				name: 'successful run writes stdout and stderr',
				input: { command: 'node', args: ['fake-report.cjs', 'success'] },
				output: { code: result.code, output: result.output }
			}
		]);
	} finally {
		rmSync(fixture.dir, { recursive: true, force: true });
	}
});

test('Resolves a nonzero exit code without rejecting', async () => {
	const fixture = makeFixture();
	try {
		const result = await reportProcess(process.execPath, [fixture.script, 'fail'], fixture.dir);
		expect(result.code).toBe(1);
		expect(result.output).toContain('Invalid report configuration');
		record('resolves-a-nonzero-exit-code-without-rejecting', [
			{
				name: 'failing report resolves with exit code 1',
				input: { command: 'node', args: ['fake-report.cjs', 'fail'] },
				output: { code: result.code, output: result.output }
			}
		]);
	} finally {
		rmSync(fixture.dir, { recursive: true, force: true });
	}
});

test('Rejects when the executable cannot be started', async () => {
	const missing = join(tmpdir(), 'report-process-missing', 'no-such-binary');
	const error: unknown = await reportProcess(missing, ['--version']).catch(
		(caught: unknown) => caught
	);
	expect(error).toBeInstanceOf(Error);
	expect((error as NodeJS.ErrnoException).code).toBe('ENOENT');
	record('rejects-when-the-executable-cannot-be-started', [
		{
			name: 'missing executable rejects with spawn error',
			input: { command: 'no-such-binary', args: ['--version'] },
			error: { code: (error as NodeJS.ErrnoException).code }
		}
	]);
});

test('Passes the explicit environment and working directory', async () => {
	const fixture = makeFixture();
	try {
		const env = { REPORT_OUTPUT_FORMAT: 'json' };
		const result = await reportProcess(process.execPath, [fixture.script, 'env'], fixture.dir, env);
		const expected = `${realpathSync(fixture.dir)} json`;
		expect(result.code).toBe(0);
		expect(result.output.trim()).toBe(expected);
		record('passes-the-explicit-environment-and-working-directory', [
			{
				name: 'explicit env and cwd reach the child process',
				input: { command: 'node', args: ['fake-report.cjs', 'env'], environment: env },
				output: { code: result.code, output: result.output.trim() }
			}
		]);
	} finally {
		rmSync(fixture.dir, { recursive: true, force: true });
	}
});

test('Keeps only the last two million characters of output', async () => {
	const fixture = makeFixture();
	try {
		const result = await reportProcess(process.execPath, [fixture.script, 'large'], fixture.dir);
		expect(result.code).toBe(0);
		expect(result.output.length).toBe(2_000_000);
		expect(result.output.endsWith('END')).toBe(true);
		record('keeps-only-the-last-two-million-characters-of-output', [
			{
				name: 'oversized output is trimmed to the tail',
				input: { command: 'node', args: ['fake-report.cjs', 'large'] },
				output: {
					code: result.code,
					outputLength: result.output.length,
					endsWithMarker: result.output.endsWith('END')
				}
			}
		]);
	} finally {
		rmSync(fixture.dir, { recursive: true, force: true });
	}
});
